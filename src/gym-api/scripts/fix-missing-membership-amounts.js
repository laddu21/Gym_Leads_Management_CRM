const { readDb, updateDb } = require('../src/storage');

console.log('🔧 Fixing converted leads without membership amounts...');

// Default membership details for leads without membership records
const DEFAULT_MEMBERSHIP = {
    plan: '1 Month Premium',
    planCategory: 'Premium',
    amount: 3500, // Default Premium 1-month price
    paymentMode: 'cash',
    preferredDate: null,
    remarks: 'Retroactively added membership data'
};

try {
    const data = readDb();
    const leads = data.leads || [];

    console.log(`Found ${leads.length} leads`);

    let fixedCount = 0;
    let skippedCount = 0;

    // Fix converted leads without membership amount
    const updatedLeads = leads.map(lead => {
        // Only process converted leads
        if (lead.status && lead.status.toLowerCase() === 'converted') {
            // Check if lead doesn't have membership amount
            if (!lead.membership || !lead.membership.amount) {
                console.log(`📝 Adding default membership for ${lead.name} (${lead.phone})`);
                fixedCount++;

                return {
                    ...lead,
                    membership: {
                        ...DEFAULT_MEMBERSHIP,
                        ...lead.membership // Preserve any existing membership fields
                    },
                    convertedAt: lead.convertedAt || lead.createdAt
                };
            } else {
                console.log(`✓ Lead ${lead.name} (${lead.phone}) already has membership amount: ₹${lead.membership.amount}`);
                skippedCount++;
            }
        }

        return lead;
    });

    // Save updated data
    updateDb((current) => {
        current.leads = updatedLeads;
        return current;
    });

    console.log('\n✅ Fix complete!');
    console.log(`   - ${fixedCount} leads updated with default membership data`);
    console.log(`   - ${skippedCount} leads already had membership amounts`);

} catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
}
