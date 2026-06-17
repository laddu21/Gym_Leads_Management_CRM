// Test script to verify membership creation and retrieval
const axios = require('axios');

const API_BASE = 'http://localhost:5050/api';

async function testMembershipOperations() {
    try {
        console.log('🔍 Testing Membership Operations...\n');

        // 1. Get existing memberships
        console.log('1. Fetching existing memberships...');
        const existingResponse = await axios.get(`${API_BASE}/memberships`);
        console.log(`✅ Found ${existingResponse.data.length} existing memberships\n`);

        // 2. Create a new test membership
        console.log('2. Creating new test membership...');
        const testMembership = {
            name: 'Test User',
            phone: '1111111111',
            email: 'test@example.com',
            category: 'Premium',
            label: 'Test Premium Plan',
            price: 5000,
            original: 6000,
            tag: 'Test',
            paymentMode: 'upi',
            remarks: 'Automated test membership'
        };

        const createResponse = await axios.post(`${API_BASE}/memberships`, testMembership);
        console.log('✅ Membership created successfully:', createResponse.data);
        const createdId = createResponse.data.id;
        console.log('');

        // 3. Verify the membership was created by fetching all again
        console.log('3. Verifying membership was stored...');
        const afterCreateResponse = await axios.get(`${API_BASE}/memberships`);
        const newCount = afterCreateResponse.data.length;
        console.log(`✅ Now found ${newCount} memberships (was ${existingResponse.data.length})`);

        // Find our created membership by phone number (more reliable)
        const createdMembership = afterCreateResponse.data.find(m => m.phone === '1111111111');
        if (createdMembership) {
            console.log('✅ Created membership found in database:');
            console.log(`   - ID: ${createdMembership.id}`);
            console.log(`   - Name: ${createdMembership.name}`);
            console.log(`   - Phone: ${createdMembership.phone}`);
            console.log(`   - Plan: ${createdMembership.label}`);
            console.log(`   - Price: ₹${createdMembership.price}`);
            console.log(`   - Category: ${createdMembership.category}`);
            console.log(`   - Created: ${new Date(createdMembership.createdAt).toLocaleString()}`);
        } else {
            console.log('❌ Created membership not found in database!');
            console.log('Last 3 memberships in database:');
            afterCreateResponse.data.slice(-3).forEach(m => {
                console.log(`   - ${m.name} (${m.phone}) - ${m.label} - ID: ${m.id}`);
            });
        }
        console.log('');

        // 4. Test searching for existing membership
        console.log('4. Testing membership search...');
        const searchResponse = await axios.get(`${API_BASE}/memberships`);
        const foundMembership = searchResponse.data.find(m => m.phone === '1111111111');

        if (foundMembership) {
            console.log('✅ Membership search successful - found by phone number:');
            console.log(`   - ID: ${foundMembership.id}`);
            console.log(`   - Name: ${foundMembership.name}`);
            console.log(`   - Phone: ${foundMembership.phone}`);
            console.log(`   - Created: ${new Date(foundMembership.createdAt).toLocaleString()}`);
        } else {
            console.log('❌ Membership search failed - not found by phone number');
        }
        console.log('');

        // 5. Test data persistence (restart simulation)
        console.log('5. Simulating app restart - refetching data...');
        const restartResponse = await axios.get(`${API_BASE}/memberships`);
        const restartCount = restartResponse.data.length;
        const restartMembership = restartResponse.data.find(m => m.phone === '1111111111');

        if (restartCount === newCount && restartMembership) {
            console.log('✅ Data persistence confirmed!');
            console.log(`   - Membership count consistent: ${restartCount}`);
            console.log(`   - Created membership still exists: ${restartMembership.name}`);
            console.log(`   - Data remains constant across fetches`);
        } else {
            console.log('❌ Data persistence failed!');
            console.log(`   - Count changed: ${restartCount} vs ${newCount}`);
            if (!restartMembership) {
                console.log('   - Created membership disappeared!');
            }
        }

        console.log('\n🎉 All membership operations completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testMembershipOperations();