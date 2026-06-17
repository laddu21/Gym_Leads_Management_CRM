const mongoose = require('mongoose');

const monthlyRegistrationSchema = new mongoose.Schema({
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
    // Store full snapshot of converted leads for this month
    leads: [{
        // Original lead data snapshot
        leadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lead'
        },
        name: String,
        phone: String,
        email: String,
        interest: String,
        plan: String,
        leadSource: String,
        source: String,
        status: String,
        convertedAt: Date,
        createdAt: Date,
        // Membership details at time of conversion
        membership: {
            planLabel: String,
            amount: Number,
            duration: Number,
            startDate: Date,
            endDate: Date
        },
        joinDate: Date,
        expiryDate: Date,
        // Archive timestamp
        archivedAt: {
            type: Date,
            default: Date.now
        }
    }],
    totalCount: {
        type: Number,
        default: 0
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: Date
}, {
    timestamps: true
});

// Compound index for year and month
monthlyRegistrationSchema.index({ year: 1, month: 1 }, { unique: true });

// Pre-save middleware to update totalCount
monthlyRegistrationSchema.pre('save', function (next) {
    this.totalCount = this.leads.length;
    next();
});

module.exports = mongoose.model('MonthlyRegistration', monthlyRegistrationSchema);