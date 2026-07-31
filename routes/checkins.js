import express from 'express';
import { body, validationResult } from 'express-validator';
import CheckIn from '../models/CheckIn.js';
import User from '../models/User.js';
import Cafe from '../models/Cafe.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// POST /api/checkins - submit a live pulse update for a cafe (the unique feature)
router.post(
  '/',
  protect,
  [
    body('cafe').notEmpty().withMessage('Cafe id is required'),
    body('seatingAvailability').isIn(['plenty', 'limited', 'full']),
    body('noiseLevel').isIn(['quiet', 'moderate', 'loud']),
    body('wifiSpeed').isIn(['fast', 'okay', 'slow', 'none']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const cafeExists = await Cafe.exists({ _id: req.body.cafe });
      if (!cafeExists) return res.status(404).json({ message: 'Cafe not found' });

      const checkIn = await CheckIn.create({
        cafe: req.body.cafe,
        user: req.user._id,
        seatingAvailability: req.body.seatingAvailability,
        noiseLevel: req.body.noiseLevel,
        wifiSpeed: req.body.wifiSpeed,
        note: req.body.note || '',
      });

      // Reward the user with points for contributing live data.
      await User.findByIdAndUpdate(req.user._id, { $inc: { points: 5 } });

      res.status(201).json({ checkIn, pointsEarned: 5 });
    } catch (err) {
      res.status(500).json({ message: 'Failed to submit check-in', error: err.message });
    }
  }
);

// GET /api/checkins/mine - a user's contribution history
router.get('/mine', protect, async (req, res) => {
  try {
    const checkIns = await CheckIn.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('cafe', 'name image');
    res.json({ checkIns });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch check-ins', error: err.message });
  }
});

export default router;
