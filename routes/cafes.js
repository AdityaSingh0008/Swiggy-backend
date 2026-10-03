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
    
    // 1. Fetch real places from Google if API key is provided and location is given
    if (config.googlePlacesApiKey && (lat && lng || q)) {
      try {
        let googleUrl = '';
        if (q) {
          googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}+cafe&key=${config.googlePlacesApiKey}`;
          if (lat && lng) googleUrl += `&location=${lat},${lng}&radius=${(radius || 10) * 1000}`;
        } else {
          googleUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${(radius || 10) * 1000}&type=cafe&key=${config.googlePlacesApiKey}`;
        }
        
        const response = await fetch(googleUrl);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          // Upsert Google places to our local DB
          const upsertPromises = data.results.map(async (place) => {
            const photoUrl = place.photos?.length > 0 
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${config.googlePlacesApiKey}`
              : 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80'; // fallback
            
            return Cafe.findOneAndUpdate(
              { externalId: place.place_id },
              {
                name: place.name,
                externalId: place.place_id,
                address: place.vicinity || place.formatted_address || '',
                location: { lat: place.geometry.location.lat, lng: place.geometry.location.lng },
                rating: place.rating || 4.0,
                ratingCount: place.user_ratings_total || 0,
                image: photoUrl,
                priceLevel: place.price_level || 2,
                tags: place.types ? place.types.filter(t => ['cafe', 'restaurant', 'food', 'point_of_interest'].includes(t)) : ['cafe'],
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          });
          await Promise.all(upsertPromises);
        }
      } catch (err) {
        console.error('Google Places API error:', err.message);
        // Fallback to local database silently
      }
    }

    // 2. Query our local database (which now includes upserted real places)
    let cafes = await Cafe.find().lean();

    if (q) {
      const query = q.toLowerCase();
      cafes = cafes.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.tags.some((t) => t.toLowerCase().includes(query)) ||
          c.cuisine.some((c2) => c2.toLowerCase().includes(query))
      );
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
    const reviews = await Review.find({ cafe: cafe._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'name avatarSeed')
      .lean();

    const isFavorite = req.user ? req.user.favorites.some((f) => f.toString() === cafe._id.toString()) : false;

    res.json({ cafe, pulse, reviews, isFavorite });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cafe', error: err.message });
  }
});

export default router;
