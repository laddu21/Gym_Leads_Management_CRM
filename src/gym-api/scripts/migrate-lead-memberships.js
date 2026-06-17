const { readDb, updateDb } = require('../src/storage');

console.log('🔧 Starting lead membership migration...');

try {
    const data = readDb();
    const leads = data.leads || [];
    const memberships = data.memberships || [];

    console.log(`Found ${leads.length} leads and ${memberships.length} memberships`);

    // Create a map of memberships by phone number
    const membershipsByPhone = new Map();
    memberships.forEach(m => {
        if (m.phone) {
            membershipsByPhone.set(m.phone, m);
        }
    });

    let updatedCount = 0;
    let alreadyLinkedCount = 0;
    let notFoundCount = 0;

    // Update converted leads with membership data
    const updatedLeads = leads.map(lead => {
        // Only process converted leads
        if (lead.status && lead.status.toLowerCase() === 'converted') {
            // Check if lead already has membership data
            if (lead.membership && lead.membership.amount) {
                console.log(`✓ Lead ${lead.name} (${lead.phone}) already has membership data`);
                alreadyLinkedCount++;
                return lead;
            }

            // Find matching membership by phone
            const membership = membershipsByPhone.get(lead.phone);
            if (membership) {
                console.log(`📝 Linking membership for ${lead.name} (${lead.phone}): ${membership.label} - ₹${membership.price}`);
                updatedCount++;

                return {
                    ...lead,
                    membership: {
                        plan: membership.label,
                        planCategory: membership.category,
                        amount: membership.price,
                        paymentMode: membership.paymentMode || '',
                        preferredDate: membership.preferredDate || null,
                        remarks: membership.remarks || ''
                    },
                    convertedAt: membership.createdAt || lead.convertedAt || lead.createdAt
                };
            } else {
                console.log(`⚠️  No membership found for ${lead.name} (${lead.phone})`);
                notFoundCount++;
                return lead;
            }
        }

        return lead;
    });

    // Save updated data
    updateDb((current) => {
        current.leads = updatedLeads;
        return current;
    });

    console.log('\n✅ Migration complete!');
    console.log(`   - ${updatedCount} leads updated with membership data`);
    console.log(`   - ${alreadyLinkedCount} leads already had membership data`);
    console.log(`   - ${notFoundCount} converted leads without matching membership records`);

} catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}
