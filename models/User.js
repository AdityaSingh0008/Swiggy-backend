import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatarSeed: { type: String, default: () => Math.random().toString(36).slice(2, 10) },
    isPremium: { type: Boolean, default: false },
    premiumSince: { type: Date },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cafe' }],
    points: { type: Number, default: 0 },
    homeLocation: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    avatarSeed: this.avatarSeed,
    isPremium: this.isPremium,
    premiumSince: this.premiumSince,
    points: this.points,
    favorites: this.favorites,
    homeLocation: this.homeLocation,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
