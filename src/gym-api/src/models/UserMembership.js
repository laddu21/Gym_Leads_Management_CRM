const mongoose = require('mongoose');

const userMembershipSchema = new mongoose.Schema({
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
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    type: {
        type: String,
        required: true,
        enum: ['normal', 'premium']
    },
    duration: {
        type: String,
        required: true,
        trim: true
    },
    paymentMode: {
        type: String,
        enum: ['upi', 'cash', 'credit-card'],
        required: true
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
userMembershipSchema.index({ phone: 1 });
userMembershipSchema.index({ date: -1 });

module.exports = mongoose.model('UserMembership', userMembershipSchema);