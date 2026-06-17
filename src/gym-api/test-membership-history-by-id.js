// Quick test for GET /api/memberships/:id/history
const axios = require('axios');

const API_BASE = 'http://localhost:5050/api';

async function run() {
    try {
        console.log('Fetching memberships...');
        const listRes = await axios.get(`${API_BASE}/memberships`);
        if (!Array.isArray(listRes.data) || listRes.data.length === 0) {
            console.log('No memberships found to test against. Create one first.');
            process.exit(0);
        }
        const target = listRes.data[0];
        console.log('Using membership:', { id: target.id, label: target.label, phone: target.phone });

        console.log('Fetching history for id with limit=5 ...');
        const histRes = await axios.get(`${API_BASE}/memberships/${encodeURIComponent(target.id)}/history`, {
            params: { limit: 5 }
        });
        console.log('History response page info:', histRes.data.page);
        console.log('First items:', histRes.data.data);

        console.log('✅ Test complete');
    } catch (err) {
        console.error('❌ Test failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

run();
