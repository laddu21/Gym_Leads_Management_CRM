import { membershipsApi } from '../services/apiClient.js';

// Define the membership plans to add (Premium only)
const plansToAdd = [
    { category: 'Premium', label: '1 Month Premium', price: 3500 },
    { category: 'Premium', label: '3 Months Premium', price: 6500 },
    { category: 'Premium', label: '6 Months Premium', price: 10500 },
    { category: 'Premium', label: '12 Months Premium', price: 16500 },
];

async function addMembershipPlans() {
    console.log('🚀 Starting to add membership plans...');

    for (const plan of plansToAdd) {
        try {
            console.log(`📝 Adding plan: ${plan.label} - $${plan.price}`);
            await membershipsApi.create(plan);
            console.log(`✅ Successfully added: ${plan.label}`);
        } catch (error) {
            console.error(`❌ Failed to add ${plan.label}:`, error.message);
        }
    }

    console.log('🎉 Finished adding membership plans!');

    // Notify frontend about plan changes
    localStorage.setItem('gym-admin-plans-updated', Date.now().toString());

    // Also send BroadcastChannel message for more reliable cross-tab communication
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
        const channel = new BroadcastChannel('gym-plans-sync');
        channel.postMessage({ type: 'plans-updated', timestamp: Date.now() });
        channel.close();
        console.log('📡 Sent BroadcastChannel message');
    }
}

// Run the function
addMembershipPlans();