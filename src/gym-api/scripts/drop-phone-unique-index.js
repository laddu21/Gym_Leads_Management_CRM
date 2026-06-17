const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-management';

async function dropPhoneIndex() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('leads');

        // Get all indexes
        const indexes = await collection.indexes();
        console.log('\nExisting indexes:');
        indexes.forEach(index => {
            console.log(`- ${index.name}:`, JSON.stringify(index.key));
        });

        // Drop the phone unique index if it exists
        try {
            await collection.dropIndex('phone_1');
            console.log('\n✅ Successfully dropped phone_1 unique index');
        } catch (error) {
            if (error.code === 27 || error.codeName === 'IndexNotFound') {
                console.log('\n⚠️  phone_1 index not found (may already be dropped)');
            } else {
                throw error;
            }
        }

        // Verify indexes after drop
        const indexesAfter = await collection.indexes();
        console.log('\nIndexes after drop:');
        indexesAfter.forEach(index => {
            console.log(`- ${index.name}:`, JSON.stringify(index.key));
        });

        console.log('\n✅ Done! You can now create leads with duplicate phone numbers.');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

dropPhoneIndex();
