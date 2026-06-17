/**
 * Script to archive October 2025 converted leads
 * This creates a permanent snapshot that will persist forever
 * 
 * Usage: node scripts/archive-october-2025.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { archiveMonth } = require('../src/utils/monthlyArchive');

async function main() {
    try {
        console.log('Connecting to database...');

        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym-dashboard';
        await mongoose.connect(MONGODB_URI);

        console.log('✓ Connected to MongoDB');
        console.log('Archiving October 2025...\n');

        // Archive October 2025
        const result = await archiveMonth(2025, 10);

        if (result.success) {
            if (result.alreadyArchived) {
                console.log('\n✓ October 2025 was already archived');
            } else {
                console.log('\n✓ Successfully archived October 2025');
            }
            console.log(`  Year: ${result.year}`);
            console.log(`  Month: ${result.month}`);
            console.log(`  Total Leads: ${result.totalCount}`);
            console.log(`  Archived At: ${result.archivedAt}`);
            console.log('\nThese leads are now permanently stored and will be available even after 10 years!');
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
