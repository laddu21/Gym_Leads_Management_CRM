const mongoose = require('mongoose');
const MonthlyPerformance = require('../src/models/MonthlyPerformance');
const { readDb, updateDb } = require('../src/storage');

async function erasePerformanceHistory() {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            console.log('Connected to MongoDB. Deleting all MonthlyPerformance documents...');
            await MonthlyPerformance.deleteMany({});
            console.log('All MonthlyPerformance documents deleted.');
        } else {
            console.log('Using file storage. Clearing performance metrics...');
            updateDb((current) => {
                if (current.metrics && current.metrics.performance) {
                    current.metrics.performance = {};
                }
                return current;
            });
            console.log('Performance metrics cleared from file storage.');
        }
    } catch (err) {
        console.error('Error erasing performance history:', err);
    } finally {
        if (mongoose.connection) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
}

erasePerformanceHistory();