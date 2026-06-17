const express = require('express');
const { readDb } = require('../storage');

const router = express.Router();

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const average = (values) => {
    if (!values.length) {
        return null;
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
};

const normalizeKey = (value, fallback) => {
    const trimmed = (value || '').trim();
    return trimmed ? trimmed : fallback;
};

router.get('/', (req, res) => {
    const data = readDb();
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    const trainers = Array.isArray(data.trainers) ? data.trainers : [];
    const pitches = Array.isArray(data.pitches) ? data.pitches : [];

    const categoryMap = new Map();
    const allPrices = [];

    memberships.forEach((plan) => {
        const categoryKey = normalizeKey(plan.category, 'Uncategorised');
        const stored = categoryMap.get(categoryKey) || { category: categoryKey, plans: 0, prices: [] };
        stored.plans += 1;
        const numericPrice = toNumber(plan.price);
        if (numericPrice !== null) {
            stored.prices.push(numericPrice);
            allPrices.push(numericPrice);
        }
        categoryMap.set(categoryKey, stored);
    });

    const membershipCategories = Array.from(categoryMap.values()).map((entry) => {
        const avg = average(entry.prices);
        return {
            category: entry.category,
            plans: entry.plans,
            averagePrice: avg !== null ? Number(avg.toFixed(2)) : null,
            minPrice: entry.prices.length ? Math.min(...entry.prices) : null,
            maxPrice: entry.prices.length ? Math.max(...entry.prices) : null
        };
    }).sort((a, b) => b.plans - a.plans);

    const now = new Date();
    const last7Days = Array.from({ length: 7 }).map((_, index) => {
        const day = new Date(now);
        day.setDate(day.getDate() - (6 - index));
        const isoDate = day.toISOString().slice(0, 10);
        const count = pitches.filter((pitch) => pitch.pitchDate === isoDate).length;
        return {
            date: isoDate,
            count
        };
    });

    const interestCounts = new Map();
    const planCounts = new Map();
    const leadCounts = new Map();

    pitches.forEach((pitch) => {
        const interestKey = normalizeKey(pitch.interest && String(pitch.interest).toUpperCase(), 'UNSPECIFIED');
        interestCounts.set(interestKey, (interestCounts.get(interestKey) || 0) + 1);

        const planKey = normalizeKey(pitch.plan, 'Unspecified');
        planCounts.set(planKey, (planCounts.get(planKey) || 0) + 1);

        const leadKey = normalizeKey(pitch.leadSource, 'Unspecified');
        leadCounts.set(leadKey, (leadCounts.get(leadKey) || 0) + 1);
    });

    const interestBreakdown = Array.from(interestCounts.entries())
        .map(([interest, count]) => ({ interest, count }))
        .sort((a, b) => b.count - a.count);

    const topPlans = Array.from(planCounts.entries())
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const leadSources = Array.from(leadCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

    const recentPitches = [...pitches]
        .sort((a, b) => {
            const first = a.recordedAt || '';
            const second = b.recordedAt || '';
            return second.localeCompare(first);
        })
        .slice(0, 10)
        .map((pitch) => ({
            id: pitch.id,
            name: pitch.name,
            phone: pitch.phone,
            plan: pitch.plan || 'Unspecified',
            interest: pitch.interest || 'Unspecified',
            leadSource: pitch.leadSource || 'Unspecified',
            pitchDate: pitch.pitchDate,
            recordedAt: pitch.recordedAt
        }));

    const payload = {
        totals: {
            memberships: memberships.length,
            trainers: trainers.length,
            pitches: pitches.length
        },
        membershipCategories,
        membershipPricing: {
            averagePrice: allPrices.length ? Number(average(allPrices).toFixed(2)) : null,
            minPrice: allPrices.length ? Math.min(...allPrices) : null,
            maxPrice: allPrices.length ? Math.max(...allPrices) : null
        },
        pitchTrends: {
            last7Days
        },
        interestBreakdown,
        leadSources,
        topPlans,
        recentPitches,
        customMetrics: data.metrics && typeof data.metrics === 'object' ? data.metrics : {},
        lastUpdated: new Date().toISOString()
    };

    res.json(payload);
});

module.exports = router;
