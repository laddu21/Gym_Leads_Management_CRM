# Gym Admin Dashboard

A React-based control panel for managing the resources exposed by the `gym-api` project.

## Features

- CRUD management for memberships and trainers.
- Pitch recording workflow with filtering by date.
- Snapshot cards for quick KPI visibility using `/api/reports`.

## Getting started

1. Install dependencies:

   ```powershell
   cd gym-admin
   npm install
   ```

2. Create an `.env` file (optional) to override the API origin:

   ```text
   VITE_API_BASE_URL=http://localhost:5050
   ```

   The default value assumes the API runs on port `5050` locally.

3. Run the development server:

   ```powershell
   npm run dev
   ```

4. Build for production:

   ```powershell
   npm run build
   ```

## Project structure

```
gym-admin/
  src/
    App.jsx             # Layout and view routing
    services/apiClient  # Thin wrapper around the Gym API
    features/           # Feature-specific screens
    components/         # Reusable UI pieces
    styles/             # Global and layout styles
```

## Notes

- All CRUD actions map directly to the REST endpoints provided by `gym-api`.
- Adjust CORS configuration in the API if you plan to host the dashboard separately.
