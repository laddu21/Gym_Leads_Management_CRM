const mongoose = require('mongoose');
const { Schema } = mongoose;

const attendanceHistoryEntrySchema = new Schema(
    {
        recordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord' },
        membershipId: { type: String },
        phone: { type: String },
        normalizedPhone: { type: String },
        checkInAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const attendanceHistorySchema = new Schema(
    {
        membershipId: { type: String, required: true },
        entries: { type: [attendanceHistoryEntrySchema], default: [] },
        totalCount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AttendanceHistory', attendanceHistorySchema);
