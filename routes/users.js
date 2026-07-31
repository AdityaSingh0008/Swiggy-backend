import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.put('/me', protect, async (req, res) => {
  try {
    const allowed = ['name', 'homeLocation'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Upgrade to Swiggy Plus premium membership (mocked, no real payment gateway).
router.post('/me/upgrade-premium', protect, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isPremium: true, premiumSince: new Date() },
      { new: true }
    );
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upgrade', error: err.message });
  }
});

export default router;
