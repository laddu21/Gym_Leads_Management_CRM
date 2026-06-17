const mongoose = require('mongoose');
const { readDb, updateDb } = require('../src/storage');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-management';

async function setConvertedAtForExistingLeads() {
    try {
        // Try MongoDB first
        if (MONGODB_URI && MONGODB_URI.includes('mongodb')) {
            await mongoose.connect(MONGODB_URI);
            console.log('Connected to MongoDB');

            const Lead = require('../src/models/Lead');

            // Find all converted leads that don't have convertedAt set
            const leadsWithoutConvertedAt = await Lead.find({
                status: /converted/i,
                convertedAt: { $exists: false }
            });

            console.log(`\nFound ${leadsWithoutConvertedAt.length} converted leads without convertedAt timestamp`);

            if (leadsWithoutConvertedAt.length > 0) {
                console.log('\nUpdating leads...');
                for (const lead of leadsWithoutConvertedAt) {
                    // Use createdAt as convertedAt for existing leads
                    lead.convertedAt = lead.createdAt || new Date();
                    await lead.save();
                    console.log(`✓ Updated lead: ${lead.name} (${lead.phone})`);
                }
                console.log(`\n✅ Successfully updated ${leadsWithoutConvertedAt.length} leads`);
            } else {
                console.log('\n✓ All converted leads already have convertedAt timestamp');
            }

            await mongoose.disconnect();
        } else {
            console.log('Using file storage...');
            // File storage fallback
            const data = readDb();
            const leads = data.leads || [];

            const convertedLeadsWithoutTimestamp = leads.filter(l =>
                String(l.status || '').toLowerCase() === 'converted' && !l.convertedAt
            );

            console.log(`\nFound ${convertedLeadsWithoutTimestamp.length} converted leads without convertedAt timestamp`);

            if (convertedLeadsWithoutTimestamp.length > 0) {
                updateDb((current) => {
                    const updatedLeads = (current.leads || []).map(lead => {
                        if (String(lead.status || '').toLowerCase() === 'converted' && !lead.convertedAt) {
                            return {
                                ...lead,
                                convertedAt: lead.createdAt || new Date().toISOString()
                            };
                        }
                        return lead;
                    });
                    current.leads = updatedLeads;
                    return current;
                });

                console.log(`\n✅ Successfully updated ${convertedLeadsWithoutTimestamp.length} leads in file storage`);

                convertedLeadsWithoutTimestamp.forEach(lead => {
                    console.log(`✓ Updated lead: ${lead.name} (${lead.phone})`);
                });
            } else {
                console.log('\n✓ All converted leads already have convertedAt timestamp');
            }
        }

        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setConvertedAtForExistingLeads();
