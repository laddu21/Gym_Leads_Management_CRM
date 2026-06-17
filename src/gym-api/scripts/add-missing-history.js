// Script to add missing create history for existing memberships.
// Usage: node scripts/add-missing-history.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Membership = require('../src/models/Membership');
const MembershipHistory = require('../src/models/MembershipHistory');

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-dashboard';
    try {
        console.log('Connecting to', uri);
        await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'gym-dashboard' });
        console.log('Connected to MongoDB');

        // Find all memberships
        const memberships = await Membership.find({}).lean();
        console.log(`Found ${memberships.length} memberships`);

        for (const membership of memberships) {
            // Check if history exists for this membership
            const existingHistory = await MembershipHistory.findOne({ membershipId: membership._id, action: 'create' });
            if (existingHistory) {
                console.log(`History already exists for membership ${membership._id}`);
                continue;
            }

            // Create history
            try {
                await MembershipHistory.create({
                    membershipId: membership._id,
                    membershipLabel: membership.label,
                    action: 'create',
                    amount: membership.price,
                    paymentMode: membership.paymentMode,
                    changes: {
                        name: membership.name,
                        phone: membership.phone,
                        email: membership.email,
                        category: membership.category,
                        label: membership.label,
                        price: membership.price,
                        original: membership.original,
                        tag: membership.tag,
                        preferredDate: membership.preferredDate,
                        paymentMode: membership.paymentMode,
                        remarks: membership.remarks
                    },
                    occurredAt: membership.createdAt || new Date()
                });
                console.log(`Created history for membership ${membership._id}`);
            } catch (err) {
                console.error(`Failed to create history for ${membership._id}:`, err.message);
            }
        }

        console.log('Done');
    } catch (err) {
        console.error('Error:', err);
        process.exitCode = 1;
    } finally {
        try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    }
}

run();