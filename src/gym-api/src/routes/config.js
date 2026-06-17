const express = require('express');
const mongoose = require('mongoose');
const { readDb, updateDb } = require('../storage');
const SiteConfig = require('../models/SiteConfig');

const router = express.Router();

const DEFAULT_BENEFITS = {
    premium: [
        'Unlimited access to all Normal Pass features',
        'Daily steam bath and sauna lounge',
        'Weekly recovery therapy session (ice or compression)',
        'Four personal training check-ins every month',
        'Custom nutrition and supplementation plans',
        'Unlimited group classes including HIIT, spin, and yoga'
    ]
};

// GET /api/config/benefits?category=premium
router.get('/benefits', async (req, res) => {
    try {
        const category = (req.query.category || 'premium').toLowerCase();
        // Prefer MongoDB
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const key = `benefits:${category}`;
            const cfg = await SiteConfig.findOne({ key });
            const items = Array.isArray(cfg?.value?.items) ? cfg.value.items.filter(Boolean) : DEFAULT_BENEFITS[category] || [];
            return res.json({ category, items });
        }

        // File storage fallback
        const data = readDb();
        const items = Array.isArray(data?.config?.benefits?.[category])
            ? data.config.benefits[category].filter(Boolean)
            : DEFAULT_BENEFITS[category] || [];
        return res.json({ category, items });
    } catch (err) {
        console.error('Failed to get benefits:', err);
        res.status(500).json({ error: 'Failed to retrieve benefits' });
    }
});

// PUT /api/config/benefits  { category: 'premium', items: [string] }
router.put('/benefits', async (req, res) => {
    try {
        const category = (req.body.category || 'premium').toLowerCase();
        const items = Array.isArray(req.body.items) ? req.body.items.map((s) => String(s).trim()).filter(Boolean) : [];
        if (!items.length) {
            return res.status(400).json({ error: 'items must be a non-empty array of strings' });
        }

        // Prefer MongoDB
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const key = `benefits:${category}`;
            const value = { category, items };
            const cfg = await SiteConfig.findOneAndUpdate(
                { key },
                { key, value },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return res.json({ category, items: cfg.value.items });
        }

        // File storage fallback
        updateDb((current) => {
            current.config = current.config || {};
            current.config.benefits = current.config.benefits || {};
            current.config.benefits[category] = items;
            return current;
        });
        return res.json({ category, items });
    } catch (err) {
        console.error('Failed to update benefits:', err);
        res.status(500).json({ error: 'Failed to update benefits' });
    }
});

module.exports = router;
