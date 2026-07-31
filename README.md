# Swiggy Plus — Backend API

Node.js + Express + MongoDB (Mongoose) REST API powering the Swiggy Plus cafe discovery app.

## Unique feature: Live Cafe Pulse
Unlike static star ratings on Swiggy/Zomato, users can "check in" at a cafe and report
**current** seating availability, noise level, and wifi speed. The API aggregates all
check-ins from the last 90 minutes into a live `vibeScore` per cafe, so the data always
reflects *right now*, not last month's review. Old check-ins age out automatically.

## Setup

```bash
npm install
cp .env.example .env   # then edit MONGO_URI / JWT_SECRET if needed
npm run seed            # populates sample cafes + a demo user + live check-ins
npm run dev              # starts on http://localhost:5000
```

Requires a running MongoDB instance (local `mongod` or a MongoDB Atlas connection string).

## Demo login
After seeding:
- email: `demo@swiggyplus.test`
- password: `demo1234`

## Environment variables (`.env`)
| Key | Description |
|---|---|
| PORT | API port, default 5000 |
| MONGO_URI | MongoDB connection string |
| JWT_SECRET | Secret used to sign auth tokens |
| JWT_EXPIRES_IN | Token lifetime, e.g. `7d` |
| CLIENT_URL | Frontend origin, for CORS |

## API overview

### Auth
- `POST /api/auth/signup` `{ name, email, password }`
- `POST /api/auth/login` `{ email, password }`
- `GET /api/auth/me` (auth required)

### Cafes
- `GET /api/cafes?lat=&lng=&radius=&q=&tag=&maxPrice=&minRating=&sort=` — list/search/nearby, includes `vibeScore`
- `GET /api/cafes/:id` — full detail incl. live pulse + reviews

### Live Pulse (unique feature)
- `POST /api/checkins` (auth) `{ cafe, seatingAvailability, noiseLevel, wifiSpeed, note? }`
- `GET /api/checkins/mine` (auth) — a user's contribution history + points earned

### Favorites
- `GET /api/favorites` (auth)
- `POST /api/favorites/:cafeId` (auth) — toggle

### Reviews
- `POST /api/reviews` (auth) `{ cafe, rating, comment? }`
- `GET /api/reviews/cafe/:cafeId`

### Users
- `PUT /api/users/me` (auth) `{ name?, homeLocation? }`
- `POST /api/users/me/upgrade-premium` (auth) — mock premium upgrade, no payment gateway

## Data model
See `models/` — `User`, `Cafe`, `CheckIn` (pulse), `Review`.

## Tech
Express, Mongoose, JWT auth (bcrypt-hashed passwords), express-validator, CORS, morgan logging.
