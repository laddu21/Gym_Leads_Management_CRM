# Gym API

Node.js + Express backend for Gym Dashboard and GymPoint applications.

## Prerequisites

- Node.js 18+
- MongoDB instance (local or Atlas cloud)

## Environment

In the `gym-api` folder, create a `.env` file with:

```bash
MONGODB_URI=mongodb://localhost:27017/gym-dashboard
PORT=5050
JWT_SECRET=your_jwt_secret_here    # secret used to sign and verify JWTs
```

- `MONGODB_URI` points to your MongoDB connection string.
- `PORT` (optional) is the HTTP port (default: 5050).

If the database connection fails, the server will fall back to JSON file storage (`data/db.json`) for development purposes.

## Setup

Install dependencies:

```powershell
cd gym-api
npm install
```

## Development

Run with auto-reload:

```powershell
npm run dev
```

## Production

Start the server:

```powershell
npm start
```

The API will be available at `http://localhost:<PORT>`.

## Role-based Access

The API uses JSON Web Tokens (JWT) for authentication. Tokens include a `role` claim (`member` by default). You may specify `role` in the OTP verification request (e.g., `{ "phone": "+12345", "otp": "123456", "role": "admin" }`).

### Key Endpoints and Required Roles

- `GET  /api/attendance/records` - list all attendance records (roles: `member`, `admin`)
- `POST /api/attendance/records` - create a new attendance record (roles: `member`, `admin`)
- `GET  /api/attendance/history` - list attendance history groups (role: `admin`)
- `POST /api/attendance/history` - replace or upsert attendance history for a membership (role: `admin`)

Refer to the code in `src/routes/attendance.js` for full role restrictions.

## Memberships API

History endpoints for memberships:

- `GET /api/memberships/history?limit=25` — Returns recent membership changes across all memberships. `limit` caps results (default 25, max 100).
- `GET /api/memberships/:id/history?limit=50&offset=0` — Returns change history for a specific membership. Supports:
  - `limit` — number of items to return (default 50, max 200)
  - `offset` — number of items to skip (default 0) for simple pagination

Example response:

```json
{
  "data": [
    {
      "id": "6738a6...",
      "membershipId": "6712b3...",
      "membershipLabel": "Monthly Plan",
      "action": "update",
      "changes": { "price": { "from": 1200, "to": 1400 } },
      "occurredAt": "2025-10-25T10:01:23.456Z"
    }
  ],
  "page": { "limit": 50, "offset": 0, "count": 1 }
}
```

For very long histories, use `offset` with `limit` to paginate. The frontend can add UI pagination later as needed.
