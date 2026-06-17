/**
 * Archive Trial Attended Leads Script
 * 
 * This script archives trial attended leads for a specific month.
 * It creates a permanent snapshot in the MonthlyTrialAttended collection.
 * 
 * Usage:
 *   node scripts/archive-trial-attended.js [year] [month]
 * 
 * Examples:
 *   node scripts/archive-trial-attended.js 2025 10    # Archive October 2025
 *   node scripts/archive-trial-attended.js            # Archive previous month
 */

const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const MonthlyTrialAttended = require('../src/models/MonthlyTrialAttended');

// Database connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gym-management';

function getMonthRange(year, month) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
}

async function archiveTrialAttended(year, month) {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Validate input
        if (!year || !month || month < 1 || month > 12) {
            throw new Error('Valid year and month (1-12) required');
        }

        console.log(`\nArchiving trial attended leads for ${year}-${String(month).padStart(2, '0')}...\n`);

        const { start, end } = getMonthRange(year, month);

        // Check if already archived
        let monthlyTrialAttended = await MonthlyTrialAttended.findOne({ year, month });

        if (monthlyTrialAttended && monthlyTrialAttended.isArchived) {
            console.log(`✓ Month already archived`);
            console.log(`  Total Count: ${monthlyTrialAttended.totalCount}`);
            console.log(`  Archived At: ${monthlyTrialAttended.archivedAt}`);
            return;
        }

        // Find all trial attended leads in this month
        console.log(`Querying leads with status "Trial Attended" from ${start.toISOString()} to ${end.toISOString()}...`);

        const allTrialAttended = await Lead.find({
            status: /trial attended/i
        }).lean();

        console.log(`Found ${allTrialAttended.length} total trial attended leads`);

        // Filter by creation date
        const monthlyTrialAttendedLeads = allTrialAttended.filter(lead => {
            const createdAt = new Date(lead.createdAt);
            return createdAt >= start && createdAt <= end;
        });

        console.log(`Filtered to ${monthlyTrialAttendedLeads.length} leads in this month`);

        if (monthlyTrialAttendedLeads.length === 0) {
            console.log('\nNo trial attended leads found for this month. Creating empty archive record...');
        }

        // Create snapshot of each lead
        const leadSnapshots = monthlyTrialAttendedLeads.map(lead => ({
            leadId: lead._id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            interest: lead.interest,
            plan: lead.plan,
            leadSource: lead.leadSource || lead.source,
            source: lead.source,
            status: lead.status,
            createdAt: lead.createdAt,
            archivedAt: new Date()
        }));

        // Create or update monthly trial attended record
        if (monthlyTrialAttended) {
            console.log('\nUpdating existing archive record...');
            monthlyTrialAttended.leads = leadSnapshots;
            monthlyTrialAttended.isArchived = true;
            monthlyTrialAttended.archivedAt = new Date();
        } else {
            console.log('\nCreating new archive record...');
            monthlyTrialAttended = new MonthlyTrialAttended({
                year,
                month,
                leads: leadSnapshots,
                isArchived: true,
                archivedAt: new Date()
            });
        }

        await monthlyTrialAttended.save();

        console.log('\n✓ Archive completed successfully!');
        console.log(`  Year: ${year}`);
        console.log(`  Month: ${month}`);
        console.log(`  Total Leads: ${leadSnapshots.length}`);
        console.log(`  Archived At: ${monthlyTrialAttended.archivedAt}`);

        // Display sample leads
        if (leadSnapshots.length > 0) {
            console.log('\nSample archived leads:');
            leadSnapshots.slice(0, 5).forEach((lead, index) => {
                console.log(`  ${index + 1}. ${lead.name} (${lead.phone}) - ${lead.status}`);
            });
            if (leadSnapshots.length > 5) {
                console.log(`  ... and ${leadSnapshots.length - 5} more`);
            }
        }

    } catch (error) {
        console.error('\n✗ Archive failed:', error.message);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Main execution
(async () => {
    try {
        // Parse command line arguments
        let year = parseInt(process.argv[2]);
        let month = parseInt(process.argv[3]);

        // If no arguments, default to previous month
        if (!year || !month) {
            const now = new Date();
            if (now.getMonth() === 0) {
                // January - archive December of previous year
                year = now.getFullYear() - 1;
                month = 12;
            } else {
                // Archive previous month of current year
                year = now.getFullYear();
                month = now.getMonth(); // getMonth() is 0-indexed, so this gives us previous month
            }
            console.log(`No month specified. Defaulting to previous month: ${year}-${String(month).padStart(2, '0')}`);
        }

        await archiveTrialAttended(year, month);
        process.exit(0);
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
})();
