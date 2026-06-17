const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
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
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    original: {
        type: Number,
        min: 0
    },
    tag: {
        type: String,
        trim: true
    },
    preferredDate: {
        type: Date
    },
    paymentMode: {
        type: String,
        enum: ['upi', 'cash', 'credit-card']
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
membershipSchema.index({ category: 1 });
membershipSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Membership', membershipSchema);