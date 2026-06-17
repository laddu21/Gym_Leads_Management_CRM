// Script to import membership data from db.json to MongoDB
// Usage: node scripts/import-memberships.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Membership = require('../src/models/Membership');
const MembershipHistory = require('../src/models/MembershipHistory');
const fs = require('fs');

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-dashboard';
    try {
        console.log('Connecting to', uri);
        await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'gym-dashboard' });
        console.log('Connected to MongoDB');

        // Read data from db.json
        const dbPath = path.join(__dirname, '../data/db.json');
        const rawData = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(rawData);

        if (!data.memberships || !Array.isArray(data.memberships)) {
            console.log('No memberships found in db.json');
            return;
        }

        console.log(`Found ${data.memberships.length} memberships to import`);

        // Clear existing data
        await Membership.deleteMany({});
        await MembershipHistory.deleteMany({});
        console.log('Cleared existing data');

        // Import memberships
        for (const membership of data.memberships) {
            try {
                const doc = new Membership({
                    name: membership.name || 'Plan', // Default name
                    phone: membership.phone || '0000000000', // Default phone
                    email: membership.email || '',
                    category: membership.category || '',
                    label: membership.label || '',
                    price: membership.price,
                    original: membership.original,
                    tag: membership.tag,
                    preferredDate: membership.preferredDate ? new Date(membership.preferredDate) : null,
                    paymentMode: membership.paymentMode || 'cash', // Default payment mode
                    remarks: membership.remarks || '',
                    createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
                    updatedAt: membership.updatedAt ? new Date(membership.updatedAt) : new Date()
                });

                if (membership.id) {
                    doc.id = membership.id;
                }

                await doc.save();
                console.log('Imported membership:', doc.label);
            } catch (err) {
                console.error('Failed to import membership:', membership.label, err.message);
            }
        }

        // Import history if available
        if (data.membershipHistory && Array.isArray(data.membershipHistory)) {
            console.log(`Found ${data.membershipHistory.length} history entries to import`);

            for (const history of data.membershipHistory) {
                try {
                    const doc = new MembershipHistory({
                        membershipId: history.membershipId,
                        membershipLabel: history.membershipLabel,
                        action: history.action,
                        changes: history.changes || {},
                        occurredAt: history.occurredAt ? new Date(history.occurredAt) : new Date()
                    });

                    if (history.id) {
                        doc.id = history.id;
                    }

                    await doc.save();
                    console.log('Imported history entry for:', history.membershipLabel);
                } catch (err) {
                    console.error('Failed to import history:', history.membershipLabel, err.message);
                }
            }
        }

        console.log('Import completed successfully');

    } catch (err) {
        console.error('Error importing data:', err);
        process.exitCode = 1;
    } finally {
        try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    }
}

run();