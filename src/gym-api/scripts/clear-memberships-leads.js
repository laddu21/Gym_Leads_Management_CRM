/**
 * Script to clear all memberships and leads data for a clean app start
 *
 * Usage:
 *   node scripts/clear-memberships-leads.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Membership = require('../src/models/Membership');
const Lead = require('../src/models/Lead');

async function main() {
    try {
        console.log('Connecting to database...');

        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym-dashboard';
        await mongoose.connect(MONGODB_URI);

        console.log('✓ Connected to MongoDB');
        console.log('\nClearing all memberships and leads data...\n');

        // Delete all memberships
        const membershipResult = await Membership.deleteMany({});
        console.log(`✓ Deleted ${membershipResult.deletedCount} memberships`);

        // Delete all leads
        const leadResult = await Lead.deleteMany({});
        console.log(`✓ Deleted ${leadResult.deletedCount} leads`);

        await mongoose.disconnect();
        console.log('\n✓ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();