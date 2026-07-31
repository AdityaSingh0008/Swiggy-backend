import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { connectDB } from './db.js';

import authRoutes from './routes/auth.js';
import cafeRoutes from './routes/cafes.js';
import checkinRoutes from './routes/checkins.js';
import favoriteRoutes from './routes/favorites.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  config.clientUrl,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/cafes', cafeRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const start = async () => {
  await connectDB();
  app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
};

start();
