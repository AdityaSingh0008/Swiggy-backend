import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { config } from '../config.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const { name, email, password } = req.body;
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }
      const user = await User.create({ name, email, password });
      const token = signToken(user._id);
      res.status(201).json({ token, user: user.toSafeObject() });
    } catch (err) {
      res.status(500).json({ message: 'Signup failed', error: err.message });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      const token = signToken(user._id);
      res.json({ token, user: user.toSafeObject() });
    } catch (err) {
      res.status(500).json({ message: 'Login failed', error: err.message });
    }
  }
);

router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

export default router;
