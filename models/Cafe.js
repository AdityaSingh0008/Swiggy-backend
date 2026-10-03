import mongoose from 'mongoose';

const cafeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    externalId: { type: String, unique: true, sparse: true },
    description: { type: String, default: '' },
    tags: [{ type: String }],
    cuisine: [{ type: String }],
    priceLevel: { type: Number, min: 1, max: 4, default: 2 },
    rating: { type: Number },
    ratingCount: { type: Number },
    image: { type: String },
    address: { type: String, default: '' },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    openingHours: { type: String, default: '8:00 AM - 10:00 PM' },
    isPremiumPartner: { type: Boolean, default: false },
    premiumPerks: [{ type: String }],
  },
  { timestamps: true }
);

cafeSchema.index({ 'location.lat': 1, 'location.lng': 1 });

export default mongoose.model('Cafe', cafeSchema);
