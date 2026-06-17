const mongoose = require('mongoose');
const { Schema } = mongoose;

const attendanceRecordSchema = new Schema(
    {
        membershipId: { type: String, required: true },
        phone: { type: String },
        normalizedPhone: { type: String },
        name: { type: String },
        planLabel: { type: String },
        planCategory: { type: String },
        checkInAt: { type: Date, default: Date.now },
        amount: { type: Number },
        startDate: { type: Date },
        expiryDate: { type: Date },
        remarks: { type: String },
        avatarUrl: { type: String }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
