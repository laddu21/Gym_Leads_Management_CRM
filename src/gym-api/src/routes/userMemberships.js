const express = require('express');
const mongoose = require('mongoose');
const UserMembership = require('../models/UserMembership');

const router = express.Router();

// Function to calculate end date from start date and duration
function calculateEndDate(startDate, duration) {
    const start = new Date(startDate);
    const durationMatch = duration.match(/^(\d+)\s*(month|months|week|weeks|day|days|year|years)$/i);
    if (!durationMatch) {
        throw new Error('Invalid duration format. Expected format: "1 month", "3 months", etc.');
    }
    const value = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();

    const end = new Date(start);
    switch (unit) {
        case 'day':
        case 'days':
            end.setDate(end.getDate() + value);
            break;
        case 'week':
        case 'weeks':
            end.setDate(end.getDate() + value * 7);
            break;
        case 'month':
        case 'months':
            end.setMonth(end.getMonth() + value);
            break;
        case 'year':
        case 'years':
            end.setFullYear(end.getFullYear() + value);
            break;
        default:
            throw new Error('Unsupported duration unit');
    }
    return end;
}

// Get all user memberships
router.get('/', async (req, res) => {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const memberships = await UserMembership.find().sort({ date: -1 });
            return res.json(memberships);
        }

        // File-storage fallback
        const { readDb } = require('../storage');
        const data = readDb();
        const memberships = Array.isArray(data.userMemberships) ? data.userMemberships.slice().reverse() : [];
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching user memberships:', error);
        res.status(500).json({ error: 'Failed to fetch user memberships' });
    }
});

// Create a user membership
router.post('/', async (req, res) => {
    try {
        const { name, phone, amount, date, type, duration, paymentMode, remarks } = req.body;

        if (!name || !phone || !amount || !type || !duration || !paymentMode) {
            return res.status(400).json({ error: 'name, phone, amount, type, duration, and paymentMode are required' });
        }

        const startDate = date ? new Date(date) : new Date();
        const endDate = calculateEndDate(startDate, duration.trim());

        const membershipData = {
            name: name.trim(),
            phone: phone.trim(),
            amount: Number(amount),
            date: startDate,
            endDate,
            type,
            duration: duration.trim(),
            paymentMode,
            remarks: remarks ? remarks.trim() : ''
        };

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const membership = new UserMembership(membershipData);
            await membership.save();
            return res.status(201).json(membership);
        }

        // File-storage fallback
        const { updateDb } = require('../storage');
        const now = new Date().toISOString();
        const newMembership = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...membershipData,
            date: membershipData.date.toISOString(),
            endDate: endDate.toISOString(),
            createdAt: now,
            updatedAt: now
        };

        updateDb((current) => {
            current.userMemberships = current.userMemberships || [];
            current.userMemberships.push(newMembership);
            return current;
        });

        res.status(201).json(newMembership);
    } catch (error) {
        console.error('Error creating user membership:', error);
        res.status(500).json({ error: 'Failed to create user membership' });
    }
});

module.exports = router;