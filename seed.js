import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDB } from './db.js';
import Cafe from './models/Cafe.js';
import User from './models/User.js';
import CheckIn from './models/CheckIn.js';

const cafes = [
  {
    name: 'The Brewing Bean',
    description: 'A cozy third-wave coffee house with single-origin pour-overs and a sunny courtyard.',
    tags: ['wifi', 'study-friendly', 'outdoor-seating', 'coffee'],
    cuisine: ['Coffee', 'Bakery'],
    priceLevel: 2,
    rating: 4.5,
    ratingCount: 128,
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    address: 'C-Scheme, Jaipur',
    location: { lat: 26.9124, lng: 75.7873 },
    isPremiumPartner: true,
    premiumPerks: ['15% off all orders', 'Free pastry with any coffee'],
  },
  {
    name: 'Terracotta Terrace',
    description: 'Rooftop cafe with panoramic city views, ideal for evening hangouts and photos.',
    tags: ['rooftop', 'scenic', 'outdoor-seating'],
    cuisine: ['Continental', 'Italian'],
    priceLevel: 3,
    rating: 4.6,
    ratingCount: 204,
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    address: 'Malviya Nagar, Jaipur',
    location: { lat: 26.8535, lng: 75.8100 },
    isPremiumPartner: true,
    premiumPerks: ['Free dessert on weekends', '10% off'],
  },
  {
    name: 'Quiet Corner Library Cafe',
    description: 'A book-lined hideaway built for deep work, with strict quiet hours and unlimited filter coffee.',
    tags: ['wifi', 'study-friendly', 'quiet'],
    cuisine: ['Coffee', 'Sandwiches'],
    priceLevel: 2,
    rating: 4.7,
    ratingCount: 96,
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80',
    address: 'Vaishali Nagar, Jaipur',
    location: { lat: 26.9155, lng: 75.7377 },
    isPremiumPartner: false,
    premiumPerks: [],
  },
  {
    name: 'Spice Route Diner',
    description: 'Casual all-day dining with a fusion menu spanning Rajasthani thalis to wood-fired pizza.',
    tags: ['family-friendly', 'full-menu'],
    cuisine: ['Indian', 'Italian', 'Fusion'],
    priceLevel: 3,
    rating: 4.3,
    ratingCount: 310,
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    address: 'Tonk Road, Jaipur',
    location: { lat: 26.8467, lng: 75.8072 },
    isPremiumPartner: true,
    premiumPerks: ['Buy 1 Get 1 on beverages'],
  },
  {
    name: 'Espresso Lane',
    description: 'Fast, no-frills espresso bar popular with commuters and students on the go.',
    tags: ['grab-and-go', 'coffee', 'budget'],
    cuisine: ['Coffee'],
    priceLevel: 1,
    rating: 4.1,
    ratingCount: 88,
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
    address: 'MI Road, Jaipur',
    location: { lat: 26.9196, lng: 75.7878 },
    isPremiumPartner: false,
    premiumPerks: [],
  },
  {
    name: 'The Garden Table',
    description: 'Open-air garden cafe with live plants at every table and a strong focus on organic ingredients.',
    tags: ['outdoor-seating', 'organic', 'pet-friendly'],
    cuisine: ['Continental', 'Salads'],
    priceLevel: 3,
    rating: 4.4,
    ratingCount: 152,
    image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80',
    address: 'Civil Lines, Jaipur',
    location: { lat: 26.9067, lng: 75.8016 },
    isPremiumPartner: true,
    premiumPerks: ['20% off for Plus members'],
  },
  {
    name: 'Midnight Brew',
    description: 'Late-night cafe for the night owls, open till 2 AM with strong espresso and board games.',
    tags: ['late-night', 'wifi', 'games'],
    cuisine: ['Coffee', 'Snacks'],
    priceLevel: 2,
    rating: 4.2,
    ratingCount: 74,
    image: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80',
    address: 'Raja Park, Jaipur',
    location: { lat: 26.9022, lng: 75.8283 },
    isPremiumPartner: false,
    premiumPerks: [],
  },
  {
    name: 'Heritage Haveli Cafe',
    description: 'A cafe set inside a restored 19th-century haveli, blending old-world charm with modern menus.',
    tags: ['scenic', 'heritage', 'outdoor-seating'],
    cuisine: ['Rajasthani', 'Continental'],
    priceLevel: 4,
    rating: 4.8,
    ratingCount: 267,
    image: 'https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=800&q=80',
    address: 'Amer Road, Jaipur',
    location: { lat: 26.9855, lng: 75.8513 },
    isPremiumPartner: true,
    premiumPerks: ['Complimentary welcome drink', '15% off'],
  },
];

const run = async () => {
  await connectDB();

  await Cafe.deleteMany({});
  await CheckIn.deleteMany({});

  const createdCafes = await Cafe.insertMany(cafes);
  console.log(`Seeded ${createdCafes.length} cafes`);

  // Seed a demo user (skip if already exists) so the reviewer can log in immediately.
  const demoEmail = 'demo@swiggyplus.test';
  let demoUser = await User.findOne({ email: demoEmail });
  if (!demoUser) {
    demoUser = await User.create({
      name: 'Demo User',
      email: demoEmail,
      password: 'demo1234',
      isPremium: true,
      premiumSince: new Date(),
    });
    console.log('Seeded demo user -> email: demo@swiggyplus.test / password: demo1234');
  }

  // Seed a few recent check-ins so the Live Pulse feature has data on first load.
  const seatingOpts = ['plenty', 'limited', 'full'];
  const noiseOpts = ['quiet', 'moderate', 'loud'];
  const wifiOpts = ['fast', 'okay', 'slow', 'none'];
  const sampleNotes = ['Great spot for calls', 'Filling up fast', 'Perfect for laptop work', ''];

  const checkInDocs = [];
  createdCafes.forEach((cafe) => {
    const numCheckIns = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numCheckIns; i++) {
      checkInDocs.push({
        cafe: cafe._id,
        user: demoUser._id,
        seatingAvailability: seatingOpts[Math.floor(Math.random() * seatingOpts.length)],
        noiseLevel: noiseOpts[Math.floor(Math.random() * noiseOpts.length)],
        wifiSpeed: wifiOpts[Math.floor(Math.random() * wifiOpts.length)],
        note: sampleNotes[Math.floor(Math.random() * sampleNotes.length)],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 60 * 1000),
      });
    }
  });
  await CheckIn.insertMany(checkInDocs);
  console.log(`Seeded ${checkInDocs.length} live check-ins`);

  console.log('Seeding complete.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
