import express from 'express';
import { body, validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Cafe from '../models/Cafe.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post(
  '/',
  protect,
  [
    body('cafe').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const cafe = await Cafe.findById(req.body.cafe);
      if (!cafe) return res.status(404).json({ message: 'Cafe not found' });

      const review = await Review.create({
        cafe: cafe._id,
        user: req.user._id,
        rating: req.body.rating,
        comment: req.body.comment || '',
      });

      const newCount = cafe.ratingCount + 1;
      const newRating = (cafe.rating * cafe.ratingCount + review.rating) / newCount;
      cafe.rating = Number(newRating.toFixed(2));
      cafe.ratingCount = newCount;
      await cafe.save();

      res.status(201).json({ review });
    } catch (err) {
      res.status(500).json({ message: 'Failed to submit review', error: err.message });
    }
  }
);

router.get('/cafe/:cafeId', async (req, res) => {
  try {
    const reviews = await Review.find({ cafe: req.params.cafeId })
      .sort({ createdAt: -1 })
      .populate('user', 'name avatarSeed');
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: err.message });
  }
});

export default router;
