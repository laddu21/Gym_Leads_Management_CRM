const mongoose = require('mongoose');

const monthlyPerformanceSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    target: {
        type: Number,
        default: 0,
        min: 0
    },
    achievedRevenue: {
        type: Number,
        default: 0,
        min: 0
    },
    convertedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    averageRevenuePerDay: {
        type: Number,
        default: 0,
        min: 0
    },
    dailyRevenue: [{
        day: {
            type: Number,
            min: 1,
            max: 31
        },
        revenue: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    lastComputedAt: {
        type: Date,
        default: Date.now
    },
    targetHistory: [
        {
            target: { type: Number, required: true },
            changedAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
});

// Create a compound index to ensure uniqueness per year-month
monthlyPerformanceSchema.index({ year: 1, month: 1 }, { unique: true });

const MonthlyPerformance = mongoose.model('MonthlyPerformance', monthlyPerformanceSchema);

module.exports = MonthlyPerformance;
