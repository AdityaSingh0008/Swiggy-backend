import express from 'express';
import User from '../models/User.js';
import Reservation from '../models/Reservation.js';
import CheckIn from '../models/CheckIn.js';
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

// GET /api/users/me/reservations
router.get('/me/reservations', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate('cafe', 'name image address isPremiumPartner')
      .sort({ date: -1, time: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reservations', error: err.message });
  }
});

// POST /api/users/:id/follow
router.post('/:id/follow', protect, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isFollowing = user.following.includes(targetUserId);
    if (isFollowing) {
      user.following = user.following.filter((id) => id.toString() !== targetUserId);
      targetUser.followers = targetUser.followers.filter((id) => id.toString() !== user._id.toString());
    } else {
      user.following.push(targetUserId);
      targetUser.followers.push(user._id);
    }

    await user.save();
    await targetUser.save();

    res.json({ following: user.following });
  } catch (err) {
    res.status(500).json({ message: "Failed to follow user" });
  }
});

// GET /api/users/feed
router.get('/feed', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // Find check-ins by users they follow
    const checkIns = await CheckIn.find({ user: { $in: user.following } })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('user', 'name avatarSeed')
      .populate('cafe', 'name image address location');

    res.json(checkIns);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

// GET /api/users/discover (suggested friends)
router.get('/discover', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const users = await User.find({
      _id: { $ne: req.user._id, $nin: user.following }
    })
      .limit(10)
      .select('name avatarSeed points isPremium');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to discover users" });
  }
});

export default router;
