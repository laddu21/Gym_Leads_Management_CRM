const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    source: {
        type: String,
        default: 'Unspecified',
        enum: ['referral', 'website', 'event', 'walk-in', 'Unspecified']
    },
    interest: {
        type: String,
        default: 'General Inquiry',
        enum: ['HOT', 'WARM', 'COLD', 'General Inquiry']
    },
    // Optional lead type used in UI (Hot/Warm/Cold)
    leadType: {
        type: String,
        enum: ['Hot', 'Warm', 'Cold'],
        required: false
    },
    status: {
        type: String,
        default: 'New',
        enum: ['New', 'Contacted', 'Trial Scheduled', 'Trial Attended', 'Qualified', 'Converted', 'Lost']
    },
    followUpDate: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        default: 0
    },
    membership: {
        plan: String,
        planCategory: {
            type: String,
            enum: ['normal', 'premium']
        },
        amount: Number,
        paymentMode: {
            type: String,
            enum: ['upi', 'cash', 'credit-card']
        },
        preferredDate: Date,
        remarks: String
    },
    joinDate: {
        type: Date
    },
    expiryDate: {
        type: Date
    },
    convertedAt: {
        type: Date
    },
    pitchDate: {
        type: String
    },
    leadSource: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
leadSchema.index({ createdAt: -1 });
leadSchema.index({ 'membership.planCategory': 1 });
leadSchema.index({ joinDate: 1 });

module.exports = mongoose.model('Lead', leadSchema);