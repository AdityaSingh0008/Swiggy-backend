import express from 'express';
import Cafe from '../models/Cafe.js';
import CheckIn from '../models/CheckIn.js';
import Review from '../models/Review.js';
import { optionalAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = express.Router();

const toRad = (deg) => (deg * Math.PI) / 180;

// Haversine distance in kilometers between two lat/lng points.
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Builds the live "Pulse" summary for a cafe from check-ins in the last
// 90 minutes — the core of the unique feature. Older check-ins decay out
// automatically so results always reflect current conditions.
const getPulse = async (cafeId) => {
  const cutoff = new Date(Date.now() - 90 * 60 * 1000);
  const recent = await CheckIn.find({ cafe: cafeId, createdAt: { $gte: cutoff } })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  if (recent.length === 0) return null;

  const mostCommon = (arr) => {
    const counts = {};
    arr.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  const seatingScore = { plenty: 3, limited: 2, full: 1 };
  const noiseScore = { quiet: 3, moderate: 2, loud: 1 };
  const wifiScore = { fast: 3, okay: 2, slow: 1, none: 0 };

  const avg = (arr, map) => arr.reduce((s, v) => s + map[v], 0) / arr.length;

  const seatingAvg = avg(recent.map((r) => r.seatingAvailability), seatingScore);
  const noiseAvg = avg(recent.map((r) => r.noiseLevel), noiseScore);
  const wifiAvg = avg(recent.map((r) => r.wifiSpeed), wifiScore);

  const vibeScore = Math.round(((seatingAvg / 3 + noiseAvg / 3 + wifiAvg / 3) / 3) * 100);

  return {
    seatingAvailability: mostCommon(recent.map((r) => r.seatingAvailability)),
    noiseLevel: mostCommon(recent.map((r) => r.noiseLevel)),
    wifiSpeed: mostCommon(recent.map((r) => r.wifiSpeed)),
    vibeScore,
    sampleSize: recent.length,
    lastUpdated: recent[0].createdAt,
    recentNotes: recent.filter((r) => r.note).slice(0, 3).map((r) => r.note),
  };
};

// GET /api/cafes  - list + nearby search + filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius, q, tag, maxPrice, minRating, sort } = req.query;
    
    let upsertedIds = new Set();
    
    // 1. Fetch real places dynamically
    if (lat && lng) {
      try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        const useGoogle = apiKey && apiKey !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE';
        
        if (useGoogle) {
          // --- GOOGLE PLACES API (Real ratings, photos, data) ---
          const qParam = q ? encodeURIComponent(q) : 'cafe';
          const radiusMeters = radius ? Number(radius) * 1000 : 5000;
          // Let the query handle the filtering naturally, don't restrict by invalid type string
          const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${qParam}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}`;
          
          const response = await fetch(gUrl);
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const upsertPromises = data.results.map(async (place) => {
              const photoUrl = place.photos && place.photos.length > 0 
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
                : '';
                
              return Cafe.findOneAndUpdate(
                { externalId: `g_${place.place_id}` },
                {
                  name: place.name,
                  externalId: `g_${place.place_id}`,
                  address: place.formatted_address,
                  location: { lat: place.geometry.location.lat, lng: place.geometry.location.lng },
                  rating: place.rating, // REAL rating
                  ratingCount: place.user_ratings_total, // REAL count
                  image: photoUrl, // REAL photo
                  priceLevel: place.price_level || 2,
                  tags: place.types || ['cafe'],
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            });
            const docs = await Promise.all(upsertPromises);
            docs.forEach(doc => {
              if (doc && doc._id) upsertedIds.add(doc._id.toString());
            });
          }
        } else {
          // --- NOMINATIM FALLBACK (No fake data!) ---
          const degreeOffset = (radius ? Number(radius) : 10) / 111;
          const left = Number(lng) - degreeOffset;
          const right = Number(lng) + degreeOffset;
          const top = Number(lat) + degreeOffset;
          const bottom = Number(lat) - degreeOffset;
          const viewbox = `${left},${top},${right},${bottom}`;
          
          const qParam = q ? encodeURIComponent(q) : 'cafe';
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${qParam}&limit=20&viewbox=${viewbox}&bounded=1&accept-language=en`;
          
          const response = await fetch(nomUrl, {
            headers: { 'User-Agent': 'SwiggyPlusInterviewApp/1.0' }
          });
          const data = await response.json();
          
          if (data && data.length > 0) {
            const upsertPromises = data.map(async (place) => {
              if (place.class !== 'amenity' && place.class !== 'shop') return null;
              
              // We DO NOT inject fake ratings or fake images anymore as requested.
              // Missing data will be handled gracefully by the frontend.
              return Cafe.findOneAndUpdate(
                { externalId: `osm_${place.osm_id}` },
                {
                  name: place.name || 'Local Cafe',
                  externalId: `osm_${place.osm_id}`,
                  address: place.display_name.split(',').slice(0, 3).join(','),
                  location: { lat: Number(place.lat), lng: Number(place.lon) },
                  tags: ['cafe', 'local'],
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            });
            const docs = await Promise.all(upsertPromises);
            docs.forEach(doc => {
              if (doc && doc._id) upsertedIds.add(doc._id.toString());
            });
          }
        }
      } catch (err) {
        console.error('Places API error:', err.message);
      }
    }

    // 2. Query our local database (which now includes upserted real places)
    let cafes = await Cafe.find().lean();

    if (q) {
      const queryWords = q.toLowerCase().split(/\s+/).filter(w => !['in','at','around','near','cafes','cafe','restaurant','restaurants'].includes(w));
      const query = queryWords.join(' ');
      
      cafes = cafes.filter((c) => {
        // If it was just directly fetched from OSM matching their query, definitely include it!
        if (upsertedIds.has(c._id.toString())) return true;
        
        // Otherwise do a loose text match
        if (!query) return true; // If they just searched "cafes in", include all in radius
        
        return c.name.toLowerCase().includes(query) ||
               query.includes(c.name.toLowerCase()) ||
               c.tags.some((t) => t.toLowerCase().includes(query)) ||
               c.cuisine.some((c2) => c2.toLowerCase().includes(query));
      });
    }
    if (tag) {
      cafes = cafes.filter((c) => c.tags.includes(tag));
    }
    if (maxPrice) {
      cafes = cafes.filter((c) => c.priceLevel <= Number(maxPrice));
    }
    if (minRating) {
      cafes = cafes.filter((c) => c.rating >= Number(minRating));
    }

    if (lat && lng) {
      const userLat = Number(lat);
      const userLng = Number(lng);
      const maxRadius = radius ? Number(radius) : 10;
      cafes = cafes
        .map((c) => ({
          ...c,
          distanceKm: Number(
            distanceKm(userLat, userLng, c.location.lat, c.location.lng).toFixed(2)
          ),
        }))
        .filter((c) => c.distanceKm <= maxRadius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    if (sort === 'rating') {
      cafes.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'priceLow') {
      cafes.sort((a, b) => a.priceLevel - b.priceLevel);
    }

    // Attach the pulse object for list views so interactive cards work smoothly.
    const withPulse = await Promise.all(
      cafes.map(async (c) => {
        const pulse = await getPulse(c._id);
        return { ...c, pulse: pulse || null, vibeScore: pulse ? pulse.vibeScore : null, hasLivePulse: !!pulse };
      })
    );

    res.json({ count: withPulse.length, cafes: withPulse });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cafes', error: err.message });
  }
});

// GET /api/cafes/:id - full detail incl. pulse + reviews
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const cafe = await Cafe.findById(req.params.id).lean();
    if (!cafe) return res.status(404).json({ message: 'Cafe not found' });

    const pulse = await getPulse(cafe._id);
    
    // Fetch local reviews
    let reviews = await Review.find({ cafe: cafe._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'name avatarSeed')
      .lean();

    // Fetch real Google Places reviews if available
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (apiKey && apiKey !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE' && cafe.externalId?.startsWith('g_')) {
      try {
        const placeId = cafe.externalId.replace('g_', '');
        const gUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;
        const gRes = await fetch(gUrl);
        const gData = await gRes.json();
        
        if (gData.result) {
          // Update local cafe rating if it changed
          if (gData.result.rating) {
            cafe.rating = gData.result.rating;
            cafe.ratingCount = gData.result.user_ratings_total;
            await Cafe.updateOne({ _id: cafe._id }, { rating: cafe.rating, ratingCount: cafe.ratingCount });
          }

          // Merge Google reviews
          if (gData.result.reviews && gData.result.reviews.length > 0) {
            const googleReviews = gData.result.reviews.map(r => ({
              _id: `g_${r.time}`,
              rating: r.rating,
              comment: r.text,
              createdAt: new Date(r.time * 1000),
              user: {
                name: r.author_name,
                avatarSeed: r.author_name, // Will generate a dicebear avatar based on name
              },
              isGoogleReview: true
            }));
            
            reviews = [...googleReviews, ...reviews].sort((a, b) => b.createdAt - a.createdAt);
          }
        }
      } catch (err) {
        console.error('Failed to fetch Google reviews:', err.message);
      }
    }

    const isFavorite = req.user ? req.user.favorites.some((f) => f.toString() === cafe._id.toString()) : false;

    res.json({ cafe, pulse, reviews, isFavorite });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cafe', error: err.message });
  }
});

export default router;
