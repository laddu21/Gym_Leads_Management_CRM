# Trial Attended Leads - Quick Reference

## What Was Implemented

✅ **Backend (API)**
- Created `MonthlyTrialAttended` model for permanent storage
- Updated `/api/monthly-reports/trial-attended` endpoint to support archived data
- Added `/api/monthly-reports/archive-trial-attended` endpoint for manual archiving
- Created `monthlyArchive.js` utility with auto-archiving functions
- Added automatic scheduling (runs on 1st of each month)
- Server startup check for missing archives

✅ **Frontend (Reports Page)**
- Updated table columns: Name, Mobile, Plan, Trial Date, Status
- Fetches data from monthly reports API with pagination
- Displays archived data for historical months
- Overview section shows current month count
- Month navigation with calendar picker
- CSV export for trial attended leads
- Auto-refresh when month changes

✅ **Scripts & Testing**
- `archive-trial-attended.js` - Manual archive script
- `test-trial-attended-api.js` - API testing script
- Comprehensive documentation

## Key Files Modified/Created

### Backend (gym-api)
1. **Models**
   - `src/models/MonthlyTrialAttended.js` (NEW)

2. **Routes**
   - `src/routes/monthly-reports.js` (UPDATED)

3. **Utils**
   - `src/utils/monthlyArchive.js` (UPDATED)

4. **Server**
   - `src/server.js` (UPDATED - added scheduler)

5. **Scripts**
   - `scripts/archive-trial-attended.js` (NEW)
   - `test-trial-attended-api.js` (NEW)

### Frontend (gympoint)
1. **Components**
   - `src/Components/Reports/ReportsPage.jsx` (UPDATED)

2. **Services**
   - `src/services/monthlyReportsService.js` (already had the method)

## How It Works

### Data Flow
```
MyLeads Page (status: "Trial Attended")
          ↓
   Monthly Archive Job
   (1st of each month)
          ↓
  MonthlyTrialAttended
    (Permanent Storage)
          ↓
    Reports Page API
          ↓
  Trial Attended Table
```

### Storage Strategy
- **Current Month**: Live data from Leads collection
- **Past Months**: Archived data from MonthlyTrialAttended collection
- **10+ Years**: All data remains accessible

## Testing Steps

### 1. Test Current Month Data
```bash
# Start the API server
cd gym-api
npm start

# In another terminal, run the test
node test-trial-attended-api.js
```

### 2. Test Manual Archive
```bash
# Archive October 2025
node scripts/archive-trial-attended.js 2025 10

# Check the output for success message
```

### 3. Test Frontend
```
1. Open Reports page in browser
2. Navigate to "Trial Attended Leads (Month)" section
3. Check if current month shows trial attended leads
4. Use month picker to view historical data
5. Test pagination (if more than 10 leads)
6. Export CSV to verify data
```

## API Usage Examples

### Get Current Month Trial Leads
```bash
curl "http://localhost:5050/api/monthly-reports/trial-attended?year=2025&month=10"
```

### Get with Pagination
```bash
curl "http://localhost:5050/api/monthly-reports/trial-attended?year=2025&month=10&page=2&limit=5"
```

### Archive a Month
```bash
curl -X POST http://localhost:5050/api/monthly-reports/archive-trial-attended \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 10}'
```

## Important Notes

1. **Automatic Archiving**
   - Runs on server startup (checks previous month)
   - Runs on 1st of each month at 00:00-00:10
   - Uses 5-minute check interval

2. **Data Safety**
   - Archives are immutable once created
   - Original lead data remains in Leads collection
   - Snapshots include all relevant fields

3. **Performance**
   - Archived data loads faster (pre-aggregated)
   - Pagination reduces memory usage
   - Indexes on year/month for quick lookups

4. **Compatibility**
   - Works with both MongoDB and file storage
   - Graceful fallback if DB unavailable
   - Compatible with existing lead structure

## Troubleshooting

### Issue: No trial leads showing
**Solution:**
- Check leads have status "Trial Attended" in MyLeads
- Verify API is running on port 5050
- Check browser console for errors

### Issue: Historical data not showing
**Solution:**
- Run manual archive script for that month
- Check if month has been archived in database
- Verify API endpoint response

### Issue: Archive job not running
**Solution:**
- Check server logs for scheduler messages
- Verify server started successfully
- Manually trigger archive with script

### Issue: Count not updating
**Solution:**
- Refresh the page
- Check if month has changed
- Verify API returns correct totalCount

## Next Steps

To fully utilize this feature:

1. **Populate Test Data**
   - Create some leads with status "Trial Attended"
   - Test with different months

2. **Run Initial Archive**
   - Archive previous months manually
   - Verify data appears in Reports

3. **Monitor Automatic Archives**
   - Check logs on 1st of each month
   - Verify archives are being created

4. **Train Users**
   - Show how to navigate months
   - Demonstrate CSV export
   - Explain data retention policy

## Support

For issues or questions:
- Check server logs: `gym-api` terminal
- Review documentation: `TRIAL_ATTENDED_STORAGE.md`
- Test API: Run `test-trial-attended-api.js`
- Manual operations: Use scripts in `gym-api/scripts/`
