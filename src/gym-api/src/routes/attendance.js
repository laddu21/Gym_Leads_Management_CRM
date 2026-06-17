const express = require('express');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceHistory = require('../models/AttendanceHistory');

const router = express.Router();
// Note: Attendance routes are publicly accessible for member check-in/check-out
// Authentication can be added later when login flow is implemented

// GET attendance records (public access for member check-in display)
router.get('/records', async (req, res) => {
    try {
        const records = await AttendanceRecord.find().sort({ checkInAt: -1 });
        res.json(records);
    } catch (err) {
        console.error('Error fetching attendance records:', err);
        res.status(500).json({ error: 'Failed to load attendance records' });
    }
});

// POST new attendance record (public access for member check-in)
router.post('/records', async (req, res) => {
    try {
        const data = req.body;
        if (!data) return res.status(400).json({ error: 'Invalid record payload' });
        const record = await AttendanceRecord.create(data);
        // Update history entry for this membership
        if (record.membershipId) {
            await AttendanceHistory.findOneAndUpdate(
                { membershipId: record.membershipId },
                { $push: { entries: { recordId: record._id, membershipId: record.membershipId, phone: record.phone, normalizedPhone: record.normalizedPhone, checkInAt: record.checkInAt } }, $inc: { totalCount: 1 } },
                { upsert: true, new: true }
            );
        }
        res.status(201).json(record);
    } catch (err) {
        console.error('Error creating attendance record:', err);
        res.status(500).json({ error: 'Failed to save attendance record' });
    }
});

// GET attendance history per membership (public access)
router.get('/history', async (req, res) => {
    try {
        const history = await AttendanceHistory.find();
        res.json(history);
    } catch (err) {
        console.error('Error fetching attendance history:', err);
        res.status(500).json({ error: 'Failed to load attendance history' });
    }
});

// POST/update attendance history (bulk) (public access)
router.post('/history', async (req, res) => {
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid history payload' });
        const history = await AttendanceHistory.findOneAndReplace({ membershipId: data.membershipId }, data, { upsert: true, new: true });
        res.status(201).json(history);
    } catch (err) {
        console.error('Error saving attendance history:', err);
        res.status(500).json({ error: 'Failed to save attendance history' });
    }
});

// DELETE attendance record by ID (public access for check-out)
router.delete('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const record = await AttendanceRecord.findByIdAndDelete(id);
        if (!record) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }
        res.json({ message: 'Attendance record removed', record });
    } catch (err) {
        console.error('Error deleting attendance record:', err);
        res.status(500).json({ error: 'Failed to delete attendance record' });
    }
});

// DELETE attendance record by membershipId or phone (public access for check-out)
router.delete('/records', async (req, res) => {
    try {
        const { membershipId, phone } = req.query;
        if (!membershipId && !phone) {
            return res.status(400).json({ error: 'Either membershipId or phone is required' });
        }

        const query = membershipId ? { membershipId } : { phone };
        const record = await AttendanceRecord.findOneAndDelete(query);

        if (!record) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        res.json({ message: 'Attendance record removed', record });
    } catch (err) {
        console.error('Error deleting attendance record:', err);
        res.status(500).json({ error: 'Failed to delete attendance record' });
    }
});

// DELETE all attendance records (for daily reset/cleanup)
router.delete('/records/all', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const result = await AttendanceRecord.deleteMany({});
        // Also clear attendance history
        await AttendanceHistory.deleteMany({});
        res.json({
            message: 'All attendance records and history cleared',
            deletedRecords: result.deletedCount
        });
    } catch (err) {
        // Enhanced error logging for debugging
        console.error('Error clearing all attendance records:', err);
        if (err && err.stack) {
            console.error('Stack trace:', err.stack);
        }
        try {
            const mongoose = require('mongoose');
            console.error('Mongoose connection state:', mongoose.connection.readyState);
            console.error('Mongoose connection host:', mongoose.connection.host);
            console.error('Mongoose connection name:', mongoose.connection.name);
        } catch (connErr) {
            console.error('Error logging mongoose connection state:', connErr);
        }
        res.status(500).json({ error: 'Failed to delete attendance record', details: err && err.message ? err.message : err });
    }
});

module.exports = router;
