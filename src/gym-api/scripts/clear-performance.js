/**
 * Script to clear all performance data for a clean app start
 *
 * Usage:
 *   node scripts/clear-performance.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MonthlyPerformance = require('../src/models/MonthlyPerformance');

async function main() {
    try {
        console.log('Connecting to database...');

        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym-dashboard';
        await mongoose.connect(MONGODB_URI);

        console.log('✓ Connected to MongoDB');
        console.log('\nClearing all performance data...\n');

        // Delete all MonthlyPerformance documents
        const result = await MonthlyPerformance.deleteMany({});

        console.log(`✓ Successfully cleared performance data`);
        console.log(`  Deleted ${result.deletedCount} performance records`);

        await mongoose.disconnect();
        console.log('\n✓ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();