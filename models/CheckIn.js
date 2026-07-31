import mongoose from 'mongoose';

// Powers the unique "Live Cafe Pulse" feature: crowd-sourced, real-time
// cafe conditions (seating, noise, wifi) that decay with time so the
// data always reflects "right now" instead of stale star ratings.
const checkInSchema = new mongoose.Schema(
  {
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seatingAvailability: { type: String, enum: ['plenty', 'limited', 'full'], required: true },
    noiseLevel: { type: String, enum: ['quiet', 'moderate', 'loud'], required: true },
    wifiSpeed: { type: String, enum: ['fast', 'okay', 'slow', 'none'], required: true },
    note: { type: String, maxlength: 140, default: '' },
  },
  { timestamps: true }
);

checkInSchema.index({ cafe: 1, createdAt: -1 });

export default mongoose.model('CheckIn', checkInSchema);
