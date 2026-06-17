const mongoose = require('mongoose');
require('dotenv').config();

// Models
const MembershipHistory = require('./src/models/MembershipHistory');
const Membership = require('./src/models/Membership');
const Lead = require('./src/models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-dashboard';

async function fetchYesterdayHistory() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!\n');

        // Calculate yesterday's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        console.log('Searching for conversions from:');
        console.log('Start:', yesterday.toISOString());
        console.log('End:', yesterdayEnd.toISOString());
        console.log('='.repeat(80));

        // Find leads converted yesterday
        const convertedLeads = await Lead.find({
            status: 'Converted',
            convertedAt: {
                $gte: yesterday,
                $lte: yesterdayEnd
            }
        }).lean();

        console.log(`\nFound ${convertedLeads.length} leads converted yesterday:\n`);

        if (convertedLeads.length === 0) {
            console.log('No leads were converted yesterday.');
            console.log('\nSearching for ANY converted leads with convertedAt date...\n');

            // Find any converted leads with convertedAt
            const anyConverted = await Lead.find({
                status: 'Converted',
                convertedAt: { $exists: true }
            }).sort({ convertedAt: -1 }).limit(10).lean();

            console.log(`Found ${anyConverted.length} recent converted leads:\n`);

            anyConverted.forEach((lead, idx) => {
                console.log(`${idx + 1}. ${lead.name} (${lead.phone})`);
                console.log(`   Converted: ${new Date(lead.convertedAt).toLocaleString()}`);
                console.log(`   Plan: ${lead.membership?.plan || 'N/A'}`);
                console.log(`   Amount: ₹${lead.membership?.amount || 0}`);
                console.log(`   Payment: ${lead.membership?.paymentMode || 'N/A'}\n`);
            });

            if (anyConverted.length > 0) {
                console.log('Now fetching order history for these leads...\n');

                for (const lead of anyConverted) {
                    await fetchHistoryForPhone(lead.phone, lead.name);
                }
            }
        } else {
            // Display converted leads and fetch their history
            for (const lead of convertedLeads) {
                console.log(`Lead: ${lead.name}`);
                console.log(`Phone: ${lead.phone}`);
                console.log(`Converted At: ${new Date(lead.convertedAt).toLocaleString()}`);
                console.log(`Plan: ${lead.membership?.plan || 'N/A'}`);
                console.log(`Amount: ₹${lead.membership?.amount || 0}`);
                console.log(`Payment Mode: ${lead.membership?.paymentMode || 'N/A'}`);
                console.log('-'.repeat(80));

                // Fetch order history for this lead
                await fetchHistoryForPhone(lead.phone, lead.name);
            }
        }

        // Also check membership history created yesterday
        console.log('\n' + '='.repeat(80));
        console.log('MEMBERSHIP HISTORY CREATED YESTERDAY:');
        console.log('='.repeat(80) + '\n');

        const historyRecords = await MembershipHistory.find({
            occurredAt: {
                $gte: yesterday,
                $lte: yesterdayEnd
            }
        }).sort({ occurredAt: -1 }).lean();

        if (historyRecords.length === 0) {
            console.log('No membership history records found for yesterday.\n');

            // Show recent history
            console.log('Showing 10 most recent history records:\n');
            const recentHistory = await MembershipHistory.find({})
                .sort({ occurredAt: -1 })
                .limit(10)
                .lean();

            displayHistoryRecords(recentHistory);
        } else {
            console.log(`Found ${historyRecords.length} history records:\n`);
            displayHistoryRecords(historyRecords);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nConnection closed.');
    }
}

async function fetchHistoryForPhone(phone, name) {
    try {
        // Normalize phone number (last 10 digits)
        const normalizePhone = (p) => String(p).replace(/\D/g, '').slice(-10);
        const phoneKey = normalizePhone(phone);

        // Find all memberships for this phone
        const memberships = await Membership.find({}).select(['_id', 'phone', 'label', 'price', 'paymentMode']).lean();
        const membershipIds = memberships
            .filter(m => normalizePhone(m.phone || '') === phoneKey)
            .map(m => m._id);

        if (membershipIds.length === 0) {
            console.log(`\n📋 Order History for ${name} (${phone}): No memberships found\n`);
            return;
        }

        // Fetch history for these memberships
        const history = await MembershipHistory.find({
            membershipId: { $in: membershipIds }
        }).sort({ occurredAt: -1 }).lean();

        console.log(`\n📋 Order History for ${name} (${phone}):`);
        console.log(`   Found ${history.length} history record(s)\n`);

        if (history.length === 0) {
            console.log('   No order history found.\n');
        } else {
            history.forEach((h, idx) => {
                console.log(`   ${idx + 1}. ${h.membershipLabel || 'Order'}`);
                console.log(`      Action: ${h.action}`);
                console.log(`      Amount: ₹${h.amount || 0}`);
                console.log(`      Payment: ${h.paymentMode || 'N/A'}`);
                console.log(`      Date: ${new Date(h.occurredAt).toLocaleString()}`);
                if (Object.keys(h.changes || {}).length > 0) {
                    console.log(`      Changes: ${JSON.stringify(h.changes, null, 2).substring(0, 200)}...`);
                }
                console.log('');
            });
        }
    } catch (error) {
        console.error(`Error fetching history for ${phone}:`, error.message);
    }
}

function displayHistoryRecords(records) {
    records.forEach((h, idx) => {
        console.log(`${idx + 1}. ${h.membershipLabel || 'Order'}`);
        console.log(`   Action: ${h.action}`);
        console.log(`   Amount: ₹${h.amount || 0}`);
        console.log(`   Payment Mode: ${h.paymentMode || 'N/A'}`);
        console.log(`   Occurred At: ${new Date(h.occurredAt).toLocaleString()}`);
        console.log(`   Membership ID: ${h.membershipId || 'N/A'}`);
        if (Object.keys(h.changes || {}).length > 0) {
            console.log(`   Changes: ${JSON.stringify(h.changes, null, 2)}`);
        }
        console.log('-'.repeat(80));
    });
}

// Run the script
fetchYesterdayHistory();
