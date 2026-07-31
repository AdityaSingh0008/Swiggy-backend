import express from 'express';
import User from '../models/User.js';
import Cafe from '../models/Cafe.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch favorites', error: err.message });
  }
});

router.post('/:cafeId', protect, async (req, res) => {
  try {
    const cafe = await Cafe.findById(req.params.cafeId);
    if (!cafe) return res.status(404).json({ message: 'Cafe not found' });

    const user = await User.findById(req.user._id);
    const already = user.favorites.some((f) => f.toString() === req.params.cafeId);
    if (already) {
      user.favorites = user.favorites.filter((f) => f.toString() !== req.params.cafeId);
    } else {
      user.favorites.push(req.params.cafeId);
    }
    await user.save();
    res.json({ isFavorite: !already, favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle favorite', error: err.message });
  }
});

export default router;
