/**
 * Generic script to archive any month's converted leads permanently
 * 
 * Usage: 
 *   node scripts/archive-month.js 2025 10          (archive October 2025)
 *   node scripts/archive-month.js 2024 12          (archive December 2024)
 *   node scripts/archive-month.js                  (archive previous month)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { archiveMonth, archivePreviousMonth } = require('../src/utils/monthlyArchive');

async function main() {
    try {
        const args = process.argv.slice(2);
        let year, month;

        if (args.length >= 2) {
            year = parseInt(args[0]);
            month = parseInt(args[1]);
            
            if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
                console.error('Invalid year or month. Usage: node archive-month.js YYYY MM');
                process.exit(1);
            }
        } else {
            // Archive previous month
            const now = new Date();
            const prevMonth = now.getMonth(); // 0-based
            year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
            month = prevMonth === 0 ? 12 : prevMonth;
            console.log('No arguments provided, archiving previous month...');
        }

        console.log('Connecting to database...');
        
        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym-dashboard';
        await mongoose.connect(MONGODB_URI);
        
        console.log('✓ Connected to MongoDB');
        console.log(`\nArchiving ${year}-${String(month).padStart(2, '0')}...\n`);

        // Archive the specified month
        const result = await archiveMonth(year, month);

        if (result.success) {
            if (result.alreadyArchived) {
                console.log(`\n✓ ${year}-${String(month).padStart(2, '0')} was already archived`);
            } else {
                console.log(`\n✓ Successfully archived ${year}-${String(month).padStart(2, '0')}`);
            }
            console.log(`  Year: ${result.year}`);
            console.log(`  Month: ${result.month}`);
            console.log(`  Total Leads: ${result.totalCount}`);
            console.log(`  Archived At: ${result.archivedAt}`);
            console.log('\n📦 These leads are now permanently stored and will remain accessible indefinitely!');
        } else {
            console.error('\n✗ Failed to archive:', result.error);
            process.exit(1);
        }

        await mongoose.disconnect();
        console.log('\n✓ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
