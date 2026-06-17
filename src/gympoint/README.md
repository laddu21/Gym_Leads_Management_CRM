# GymPoint Frontend

React interface for the public GymPoint experience. The app consumes the same REST API that powers the Gym Admin dashboard, so updates made in `gym-admin` (e.g. trainer roster, membership prices, recorded pitches, and metrics) appear here automatically.

## Prerequisites

- Node.js 18+
- The Gym API running locally (`npm install` then `npm start` inside `gym-api`).

## Environment

Create a `.env` file to point the app at the API origin. The default assumes the API runs on `http://localhost:5050`:

```bash
REACT_APP_GYM_API_URL=http://localhost:5050/api
```

## Development

```powershell
cd gympoint
npm install
npm start
```

The site runs on `http://localhost:3000`. API requests are proxied to `REACT_APP_GYM_API_URL`.

## Production build

```powershell
npm run build
```

Outputs are written to `build/`.

## Data flow

- **Memberships:** loaded from `GET /api/memberships?category=...` with graceful fallbacks.
- **Trainers:** fetched from `GET /api/trainers`. The Employees view now persists add/edit/delete actions through the API, keeping Gym Admin and GymPoint in sync.
- **Pitches & Reports:** reuse `/api/pitches` and `/api/reports` for end-to-end parity with the admin console.

If the API is unreachable, the UI surfaces a fallback message and sample data so the layout remains usable.
