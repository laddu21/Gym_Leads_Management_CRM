// Script to import leads data from db.json to MongoDB
// Usage: node scripts/import-leads.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const MonthlyRegistration = require('../src/models/MonthlyRegistration');
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

        if (!data.leads || !Array.isArray(data.leads)) {
            console.log('No leads found in db.json');
            return;
        }

        console.log(`Found ${data.leads.length} leads to import`);

        // Clear existing data
        await Lead.deleteMany({});
        await MonthlyRegistration.deleteMany({});
        console.log('Cleared existing leads data');

        // Import leads
        for (const lead of data.leads) {
            try {
                // Map source values to valid enum values
                let source = lead.source || 'Unspecified';
                if (source === 'Walk-in') source = 'walk-in';
                if (source === 'Referral') source = 'referral';
                if (source === 'Website') source = 'website';
                if (source === 'Event') source = 'event';

                // Map interest values to valid enum values
                let interest = lead.interest || 'General Inquiry';
                if (interest === '12 Months' || interest === 'HOT') interest = 'HOT';
                if (interest === 'WARM') interest = 'WARM';
                if (interest === 'COLD') interest = 'COLD';

                const doc = new Lead({
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email || '',
                    source: source,
                    interest: interest,
                    leadType: ['Hot', 'Warm', 'Cold'].includes(lead.leadType) ? lead.leadType : undefined,
                    status: lead.status || 'New',
                    followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null,
                    notes: lead.notes || '',
                    membership: lead.membership || null,
                    joinDate: lead.joinDate ? new Date(lead.joinDate) : null,
                    expiryDate: lead.expiryDate ? new Date(lead.expiryDate) : null,
                    convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
                    pitchDate: lead.pitchDate ? new Date(lead.pitchDate) : null,
                    leadSource: lead.leadSource || null,
                    createdAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
                    updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : new Date()
                });

                if (lead.id) {
                    doc.id = lead.id;
                }

                await doc.save();
                console.log('Imported lead:', doc.name);

                // Track monthly registration if joinDate exists
                if (doc.joinDate) {
                    const registrationDate = doc.joinDate;
                    const year = registrationDate.getFullYear();
                    const month = registrationDate.getMonth() + 1;

                    let monthlyReg = await MonthlyRegistration.findOne({ year, month });
                    if (!monthlyReg) {
                        monthlyReg = new MonthlyRegistration({ year, month, registrations: [] });
                    }

                    monthlyReg.registrations.push({
                        leadId: doc._id,
                        registeredAt: registrationDate
                    });

                    await monthlyReg.save();
                }
            } catch (err) {
                console.error('Failed to import lead:', lead.name, err.message);
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