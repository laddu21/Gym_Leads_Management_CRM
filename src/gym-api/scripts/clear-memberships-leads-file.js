/**
 * Script to clear memberships and leads data from file storage for a clean app start
 *
 * Usage:
 *   node scripts/clear-memberships-leads-file.js
 */

const { updateDb } = require('../src/storage');

console.log('Clearing memberships and leads data from file storage...\n');

try {
    updateDb((current) => {
        current.memberships = [];
        current.leads = [];
        current.membershipHistory = [];
        return current;
    });

    console.log('✓ Successfully cleared memberships and leads data from file storage');
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}