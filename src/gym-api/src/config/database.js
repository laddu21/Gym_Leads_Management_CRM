const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-dashboard';
        const isProduction = process.env.NODE_ENV === 'production';

        console.log('Attempting to connect to MongoDB...');
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

        const conn = await mongoose.connect(mongoURI, {
            dbName: 'gym-dashboard'
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`✅ Database: ${conn.connection.name}`);
        console.log(`✅ Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Unknown'}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('Full error:', error);

        // In production, MongoDB is MANDATORY - fail fast
        if (process.env.NODE_ENV === 'production') {
            console.error('');
            console.error('═══════════════════════════════════════════════════════');
            console.error('🚨 CRITICAL ERROR: MongoDB connection failed in PRODUCTION');
            console.error('═══════════════════════════════════════════════════════');
            console.error('');
            console.error('Production deployment REQUIRES a working database connection.');
            console.error('Please verify:');
            console.error('  1. MONGODB_URI environment variable is set correctly');
            console.error('  2. MongoDB server is running and accessible');
            console.error('  3. Network/firewall allows connection to MongoDB');
            console.error('  4. Database credentials are valid');
            console.error('');
            console.error('Server will exit now to prevent data loss.');
            console.error('═══════════════════════════════════════════════════════');
            console.error('');

            // Exit process - DO NOT continue without database in production
            process.exit(1);
        }

        // In development, allow fallback to file storage with warning
        console.warn('');
        console.warn('⚠️  WARNING: Continuing without MongoDB in DEVELOPMENT mode');
        console.warn('⚠️  The server will use file-storage mode (db.json)');
        console.warn('⚠️  Some features may be limited');
        console.warn('⚠️  This is NOT suitable for production!');
        console.warn('');

        // Disconnect mongoose to prevent further attempts
        await mongoose.disconnect();
    }
};

module.exports = connectDB;