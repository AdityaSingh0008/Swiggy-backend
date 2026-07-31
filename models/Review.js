import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Review', reviewSchema);
