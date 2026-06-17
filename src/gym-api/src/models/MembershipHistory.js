const mongoose = require('mongoose');

const membershipHistorySchema = new mongoose.Schema({
    membershipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Membership'
    },
    membershipLabel: {
        type: String,
        trim: true
    },
    action: {
        type: String,
        enum: ['create', 'update', 'delete'],
        required: true
    },
    amount: {
        type: Number,
        default: null
    },
    paymentMode: {
        type: String,
        trim: true,
        default: null
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    occurredAt: {
        type: Date,
        default: Date.now
    }
});

// Keep queries for recent history fast
membershipHistorySchema.index({ occurredAt: -1 });

module.exports = mongoose.model('MembershipHistory', membershipHistorySchema);
