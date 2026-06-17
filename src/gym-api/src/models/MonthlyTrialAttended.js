const mongoose = require('mongoose');

const monthlyTrialAttendedSchema = new mongoose.Schema({
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
    // Store full snapshot of trial attended leads for this month
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
        trialAttendedAt: Date,
        createdAt: Date,
        notes: String,
        remarks: String,
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
monthlyTrialAttendedSchema.index({ year: 1, month: 1 }, { unique: true });

// Pre-save middleware to update totalCount
monthlyTrialAttendedSchema.pre('save', function (next) {
    this.totalCount = this.leads.length;
    next();
});

module.exports = mongoose.model('MonthlyTrialAttended', monthlyTrialAttendedSchema);
