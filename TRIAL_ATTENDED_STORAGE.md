# Trial Attended Leads - Permanent Storage Implementation

## Summary
Implemented permanent database storage for trial attended leads to ensure data persists across app restarts.

## Problem
Trial attended leads were showing correctly when the app was running, but disappeared after closing and reopening the app. The table would show 0 leads even though 15 leads existed in the raw data.

## Root Cause
The trial attended leads were only being filtered from the `Lead` collection based on status, without any archiving or permanent storage mechanism. When the app restarted, the query would run fresh without any cached or archived data.

## Solution
Implemented a permanent archiving system similar to the "All Members" table using the `MonthlyTrialAttended` collection.

## Changes Made

### 1. Created MonthlyTrialAttended Model
**File:** `gym-api/src/models/MonthlyTrialAttended.js`

- Schema stores monthly snapshots of trial attended leads
- Compound unique index on `{year, month}`
- Fields: `year`, `month`, `leads[]`, `totalCount`, `isArchived`, `archivedAt`
- Pre-save hook automatically updates `totalCount`
- Each lead snapshot includes: `leadId`, `name`, `phone`, `email`, `interest`, `plan`, `leadSource`, `source`, `status`, `createdAt`, `archivedAt`

### 2. Updated Trial Attended Route (GET)
**File:** `gym-api/src/routes/monthly-reports.js`

**Archive-First Retrieval Logic:**
1. Check for archived `MonthlyTrialAttended` record first
2. If month is archived, return permanent data immediately
3. For current/unarchived months:
   - Query live `Lead` collection for trial attended leads
   - Auto-create or update archive record
   - Prevent duplicates using `leadId` tracking
   - Merge live data with archived snapshots
4. Return combined dataset with pagination

**File Storage Fallback:**
- Uses `data.monthlyTrialAttended` array for JSON storage
- Same archiving logic for consistency

### 3. Added Archive Endpoint (POST)
**File:** `gym-api/src/routes/monthly-reports.js`

**Endpoint:** `POST /api/monthly-reports/archive-trial-attended`

**Body:**
```json
{
  "year": 2025,
  "month": 10
}
```

**Functionality:**
- Archives a specific month's trial attended leads permanently
- Marks record as `isArchived: true`
- Sets `archivedAt` timestamp
- Prevents duplicate archiving
- Supports both MongoDB and file storage

### 4. Created Archive Script
**File:** `gym-api/scripts/archive-trial-attended.js`

**Usage:**
```bash
# Archive specific month
node scripts/archive-trial-attended.js 2025 10

# Archive previous month (default)
node scripts/archive-trial-attended.js
```

**Features:**
- Archives trial attended leads for a specific month
- Defaults to previous month if no arguments provided
- Validates input (year, month 1-12)
- Checks for existing archives to prevent duplicates
- Creates permanent snapshot in `MonthlyTrialAttended` collection
- Displays summary with sample leads

## Data Flow

### Before (Problem)
1. App requests trial attended leads
2. API queries `Lead` collection with `status: /trial attended/i`
3. Filters by date range
4. Returns data
5. **App restart → Query runs fresh → 0 leads shown (data not persisted)**

### After (Solution)
1. App requests trial attended leads for a month
2. API checks `MonthlyTrialAttended` collection first
3. If archived record exists:
   - Return permanent archived data
4. If no archive or current month:
   - Query live `Lead` collection
   - Create/update archive record with new leads
   - Merge with existing archive
   - Return combined data
5. **App restart → Archive persists → All leads shown correctly**

## Testing Steps

1. **Create trial attended leads:**
   ```bash
   # Manually create leads with status "Trial Attended" in the database
   ```

2. **Verify initial fetch:**
   ```bash
   GET /api/monthly-reports/trial-attended?year=2025&month=1
   ```
   Should show all trial attended leads for the month.

3. **Check auto-archiving:**
   - Archive record should be created automatically
   - Query `MonthlyTrialAttended` collection to verify

4. **Restart app:**
   - Stop backend/frontend
   - Restart both
   - Navigate to Reports page → Trial Attended table
   - Should show all leads (15 leads instead of 0)

5. **Manual archiving (optional):**
   ```bash
   # Archive previous month
   node scripts/archive-trial-attended.js

   # Archive specific month
   node scripts/archive-trial-attended.js 2025 10
   ```

6. **Verify archived data:**
   ```bash
   GET /api/monthly-reports/trial-attended?year=2025&month=10
   ```
   Should return data from archive with `isArchived: true`.

## Key Benefits

✅ **Permanent Storage:** Trial attended leads persist across app restarts
✅ **Auto-Archiving:** Archive records created/updated automatically on each fetch
✅ **Historical Data:** Previous months' data preserved forever
✅ **Performance:** Archived months return instantly from stored snapshots
✅ **Consistency:** Uses same pattern as "All Members" table (proven working)
✅ **Duplicate Prevention:** Tracks `leadId` to prevent duplicate entries
✅ **Flexible Storage:** Supports both MongoDB and file storage backends

## API Reference

### GET /api/monthly-reports/trial-attended
Get trial attended leads for a specific month with automatic archiving.

**Query Parameters:**
- `year` (optional): Year (defaults to current year)
- `month` (optional): Month 1-12 (defaults to current month)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "year": 2025,
  "month": 1,
  "totalCount": 15,
  "page": 1,
  "limit": 10,
  "totalPages": 2,
  "leads": [...],
  "data": [...],
  "isArchived": false,
  "archivedAt": "2025-01-15T10:30:00.000Z"
}
```

### POST /api/monthly-reports/archive-trial-attended
Manually archive a month's trial attended leads.

**Body:**
```json
{
  "year": 2025,
  "month": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Trial attended leads archived successfully",
  "year": 2025,
  "month": 10,
  "totalCount": 15,
  "archivedAt": "2025-01-15T10:30:00.000Z"
}
```

## Database Schema

### MonthlyTrialAttended Collection
```javascript
{
  year: Number,              // 2025
  month: Number,             // 1-12
  leads: [
    {
      leadId: ObjectId,      // Reference to Lead._id
      name: String,
      phone: String,
      email: String,
      interest: String,
      plan: String,
      leadSource: String,
      source: String,
      status: String,
      createdAt: Date,
      archivedAt: Date
    }
  ],
  totalCount: Number,        // Auto-updated via pre-save hook
  isArchived: Boolean,       // Manual archiving flag
  archivedAt: Date,          // When manually archived
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Compound unique index: `{year: 1, month: 1}`

## File Storage Structure

For file-based storage (JSON fallback):
```json
{
  "monthlyTrialAttended": [
    {
      "year": 2025,
      "month": 1,
      "leads": [...],
      "totalCount": 15,
      "isArchived": true,
      "archivedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

## Future Enhancements

1. **Scheduled Archiving:** Add cron job to automatically archive previous month on 1st of each month
2. **Export Functionality:** Add CSV/Excel export for archived trial attended leads
3. **Bulk Operations:** Archive multiple months at once
4. **Archive Rollback:** Ability to un-archive a month if needed
5. **Analytics Dashboard:** Show trial attended trends over time using archived data

## Related Files

- `gym-api/src/models/MonthlyTrialAttended.js` - Data model
- `gym-api/src/routes/monthly-reports.js` - API routes
- `gym-api/scripts/archive-trial-attended.js` - Archive script
- `gympoint/src/Components/Reports/ReportsPage.jsx` - Frontend table (no changes needed)

## Notes

- Auto-archiving happens on every GET request for non-archived months
- Manual archiving sets `isArchived: true` and prevents further auto-updates
- Archive script can be run manually or scheduled via cron/task scheduler
- Frontend requires no changes - API response structure remains compatible
