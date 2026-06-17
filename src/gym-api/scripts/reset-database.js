const { updateDb } = require('../src/storage');

const DEFAULT_CONTENT = {
    memberships: [],
    trainers: [],
    pitches: [],
    leads: [],
    membershipHistory: [],
    userMemberships: [],
    metrics: {}
};

console.log('Resetting database to default empty state...');
updateDb(() => DEFAULT_CONTENT);
console.log('Database reset complete. All data cleared.');