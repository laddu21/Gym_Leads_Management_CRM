// Simple script to test membership creation directly against the database.
// Usage: node scripts/test-create-membership.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Membership = require('../src/models/Membership');

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-dashboard';
    try {
        console.log('Connecting to', uri);
        await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'gym-dashboard' });
        console.log('Connected to MongoDB');

        const samples = [
            { category: 'Test', label: `Numeric ${Date.now()}`, price: 1500, original: 2000, tag: 'script-numeric' },
            { category: 'Test', label: `CurrencyString ${Date.now()}`, price: '$2,500', original: '3,000', tag: 'script-currency' }
        ];

        for (const s of samples) {
            try {
                const doc = await Membership.create(s);
                console.log('Created membership:', { id: doc._id.toString(), label: doc.label, price: doc.price, original: doc.original });
            } catch (err) {
                console.error('Failed to create sample membership:', s, err && err.message ? err.message : err);
            }
        }
    } catch (err) {
        console.error('Error creating membership:', err);
        process.exitCode = 1;
    } finally {
        try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    }
}

run();
