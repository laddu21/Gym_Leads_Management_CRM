/**
 * Script to clear performance data from file storage for a clean app start
 *
 * Usage:
 *   node scripts/clear-performance-file.js
 */

const { updateDb } = require('../src/storage');

console.log('Clearing performance data from file storage...\n');

try {
    updateDb((current) => {
        if (current.metrics && current.metrics.performance) {
            console.log('Found performance data in file storage, clearing...');
            current.metrics.performance = {};
        } else {
            console.log('No performance data found in file storage');
        }
        return current;
    });

    console.log('✓ Successfully cleared performance data from file storage');
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}