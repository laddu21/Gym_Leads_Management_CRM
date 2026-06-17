
const express = require('express');
const mongoose = require('mongoose');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const Membership = require('../models/Membership');
const Lead = require('../models/Lead');
const { readDb, updateDb } = require('../storage');

const router = express.Router();

// Get all target changes (full history)
router.get('/target-history', async (req, res) => {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Flatten all targetHistory entries for all months
            const docs = await MonthlyPerformance.find({}, { year: 1, month: 1, targetHistory: 1, _id: 0 }).sort({ year: 1, month: 1 });
            // Each doc: { year, month, targetHistory: [ { target, changedAt } ] }
            const history = [];
            docs.forEach(doc => {
                if (Array.isArray(doc.targetHistory)) {
                    doc.targetHistory.forEach(entry => {
                        history.push({
                            year: doc.year,
                            month: doc.month,
                            target: entry.target,
                            changedAt: entry.changedAt
                        });
                    });
                }
            });
            // Sort by changedAt ascending
            history.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
            return res.json({ history });
        }
        // File-storage fallback
        const data = readDb();
        const perf = (data.metrics && data.metrics.performance) || {};
        let history = [];
        Object.values(perf).forEach(entry => {
            if (Array.isArray(entry.targetHistory)) {
                entry.targetHistory.forEach(h => {
                    history.push({
                        year: entry.year,
                        month: entry.month,
                        target: h.target,
                        changedAt: h.changedAt
                    });
                });
            } else if (entry.target) {
                history.push({
                    year: entry.year,
                    month: entry.month,
                    target: entry.target,
                    changedAt: entry.lastComputedAt || null
                });
            }
        });
        history.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
        return res.json({ history });
    } catch (err) {
        console.error('Failed to fetch target history:', err);
        res.status(500).json({ error: 'Failed to fetch target history' });
    }
});

const getMonthRange = (year, month) => {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
};

const computeMonthly = async (year, month) => {
    const { start, end } = getMonthRange(year, month);

    if (mongoose.connection && mongoose.connection.readyState === 1) {
        // Memberships revenue for month
        const memberships = await Membership.find({ createdAt: { $gte: start, $lte: end } }).select('price createdAt').lean();
        const membershipRevenue = memberships.reduce((sum, m) => sum + (Number(m.price) || 0), 0);

        // Get ALL converted leads for the month - any lead with status "Converted" 
        // that was converted in this month (based on convertedAt, or createdAt if no convertedAt)
        const allConvertedLeads = await Lead.find({
            status: /converted/i
        }).select('membership.amount convertedAt createdAt status').lean();

        // Filter to get only those converted in this month
        const convertedLeadsThisMonth = allConvertedLeads.filter(lead => {
            const conversionDate = lead.convertedAt ? new Date(lead.convertedAt) : new Date(lead.createdAt);
            return conversionDate >= start && conversionDate <= end;
        });

        const convertedCount = convertedLeadsThisMonth.length;
        const leadsRevenue = convertedLeadsThisMonth.reduce((sum, lead) => sum + (Number(lead.membership?.amount) || 0), 0);

        console.log(`Performance calculation for ${year}-${month}:`);
        console.log(`- Memberships: ${memberships.length}, Revenue: ${membershipRevenue}`);
        console.log(`- Converted Leads: ${convertedCount}, Revenue: ${leadsRevenue}`);
        console.log(`- Total Revenue: ${membershipRevenue + leadsRevenue}`);

        // Total revenue from converted leads
        const achievedRevenue = leadsRevenue;

        // Build daily map from converted leads
        const dailyMap = new Map();
        convertedLeadsThisMonth.forEach((lead) => {
            const d = new Date(lead.convertedAt || lead.createdAt);
            const day = d.getUTCDate();
            dailyMap.set(day, (dailyMap.get(day) || 0) + (Number(lead.membership?.amount) || 0));
        });

        const daysInMonth = new Date(year, month, 0).getUTCDate();
        const today = new Date();
        const currentMonth = today.getUTCMonth() + 1;
        const currentYear = today.getUTCFullYear();
        const daysSoFar = (year === currentYear && month === currentMonth) ? today.getUTCDate() : daysInMonth;
        const averageRevenuePerDay = daysSoFar > 0 ? achievedRevenue / daysSoFar : 0;

        const dailyRevenue = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            revenue: dailyMap.get(i + 1) || 0
        }));

        return { achievedRevenue, convertedCount, averageRevenuePerDay, dailyRevenue };
    }

    // File storage fallback
    const data = readDb();
    const memberships = (data.memberships || []).filter((m) => {
        const createdAt = new Date(m.createdAt || m.created_at);
        return createdAt >= start && createdAt <= end;
    });
    const membershipRevenue = memberships.reduce((sum, m) => sum + (Number(m.price) || 0), 0);

    // Get all converted leads first
    const allConvertedLeads = (data.leads || []).filter((l) => {
        return String(l.status || '').toLowerCase() === 'converted';
    });

    // Then filter by date
    const leads = allConvertedLeads.filter((l) => {
        const convertedAt = l.convertedAt ? new Date(l.convertedAt) : null;
        const basis = convertedAt || new Date(l.createdAt);
        return basis >= start && basis <= end;
    });

    console.log(`Performance calculation (file storage) for ${year}-${month}:`);
    console.log(`- Memberships: ${memberships.length}, Revenue: ${membershipRevenue}`);
    console.log(`- Converted Leads: ${leads.length}, Revenue from leads: ${leads.reduce((sum, l) => sum + (Number(l.membership?.amount) || 0), 0)}`);

    const leadsRevenue = leads.reduce((sum, l) => sum + (Number(l.membership?.amount) || 0), 0);
    const achievedRevenue = leadsRevenue;

    const daysInMonth = new Date(year, month, 0).getUTCDate();
    const today = new Date();
    const currentMonth = today.getUTCMonth() + 1;
    const currentYear = today.getUTCFullYear();
    const daysSoFar = (year === currentYear && month === currentMonth) ? today.getUTCDate() : daysInMonth;
    const averageRevenuePerDay = daysSoFar > 0 ? achievedRevenue / daysSoFar : 0;

    const dailyMap = new Map();
    leads.forEach((l) => {
        const convertedAt = l.convertedAt ? new Date(l.convertedAt) : null;
        const d = convertedAt || new Date(l.createdAt);
        const day = d.getUTCDate();
        dailyMap.set(day, (dailyMap.get(day) || 0) + (Number(l.membership?.amount) || 0));
    });

    const dailyRevenue = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: dailyMap.get(i + 1) || 0
    }));

    return { achievedRevenue, convertedCount: leads.length, averageRevenuePerDay, dailyRevenue };
};

router.get('/', async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.query.year) || now.getUTCFullYear();
        const month = Number(req.query.month) || (now.getUTCMonth() + 1);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            let doc = await MonthlyPerformance.findOne({ year, month });
            if (!doc) {
                return res.json({
                    year,
                    month,
                    target: 0,
                    achievedRevenue: 0,
                    convertedCount: 0,
                    averageRevenuePerDay: 0,
                    lastComputedAt: null
                });
            }
            if (doc.target === 0) {
                return res.json({
                    year,
                    month,
                    target: 0,
                    achievedRevenue: 0,
                    convertedCount: 0,
                    averageRevenuePerDay: 0,
                    lastComputedAt: doc.lastComputedAt
                });
            }
            // Target is set, compute and update
            const computed = await computeMonthly(year, month);
            doc.achievedRevenue = computed.achievedRevenue;
            doc.convertedCount = computed.convertedCount;
            doc.averageRevenuePerDay = computed.averageRevenuePerDay;
            doc.dailyRevenue = computed.dailyRevenue;
            doc.lastComputedAt = new Date();
            await doc.save();

            return res.json({
                year,
                month,
                target: doc.target || 0,
                achievedRevenue: doc.achievedRevenue || 0,
                convertedCount: doc.convertedCount || 0,
                averageRevenuePerDay: doc.averageRevenuePerDay || 0,
                lastComputedAt: doc.lastComputedAt || null
            });
        }

        // File-storage fallback
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const data = readDb();
        const entry = (data.metrics && data.metrics.performance && data.metrics.performance[key]) || null;
        if (!entry || entry.target === 0) {
            return res.json({
                year,
                month,
                target: 0,
                achievedRevenue: 0,
                convertedCount: 0,
                averageRevenuePerDay: 0,
                lastComputedAt: entry ? entry.lastComputedAt : null
            });
        }
        // Target set, compute
        const computed = await computeMonthly(year, month);
        let payload = { year, month, target: entry.target, ...computed, lastComputedAt: new Date() };
        updateDb((current) => {
            current.metrics = current.metrics || {};
            current.metrics.performance = current.metrics.performance || {};
            current.metrics.performance[key] = { ...entry, ...computed, lastComputedAt: new Date() };
            return current;
        });
        return res.json(payload);
    } catch (err) {
        console.error('Failed to fetch monthly performance:', err);
        res.status(500).json({ error: 'Failed to fetch monthly performance' });
    }
});

router.post('/target', async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.body.year) || now.getUTCFullYear();
        const month = Number(req.body.month) || (now.getUTCMonth() + 1);
        const target = Number(req.body.target) || 0;

        if (target < 0) {
            return res.status(400).json({ error: 'target must be >= 0' });
        }

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const computed = await computeMonthly(year, month);
            // Always append to targetHistory, never replace
            let doc = await MonthlyPerformance.findOne({ year, month });
            if (!doc) {
                doc = new MonthlyPerformance({ year, month, target, ...computed, lastComputedAt: new Date(), targetHistory: [{ target, changedAt: new Date() }] });
            } else {
                doc.target = target;
                doc.achievedRevenue = computed.achievedRevenue;
                doc.convertedCount = computed.convertedCount;
                doc.averageRevenuePerDay = computed.averageRevenuePerDay;
                doc.dailyRevenue = computed.dailyRevenue;
                doc.lastComputedAt = new Date();
                // Only append, never reset
                if (!Array.isArray(doc.targetHistory)) doc.targetHistory = [];
                doc.targetHistory.push({ target, changedAt: new Date(), achievement: computed.achievedRevenue });
            }
            await doc.save();
            return res.json({
                year: doc.year,
                month: doc.month,
                target: doc.target,
                achievedRevenue: doc.achievedRevenue,
                convertedCount: doc.convertedCount,
                averageRevenuePerDay: doc.averageRevenuePerDay,
                lastComputedAt: doc.lastComputedAt
            });
        }

        // File-storage fallback
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const computed = await computeMonthly(year, month);
        let payload = null;
        updateDb((current) => {
            current.metrics = current.metrics || {};
            current.metrics.performance = current.metrics.performance || {};
            const entry = current.metrics.performance[key] || { year, month, targetHistory: [] };
            entry.target = target;
            entry.achievedRevenue = computed.achievedRevenue;
            entry.convertedCount = computed.convertedCount;
            entry.averageRevenuePerDay = computed.averageRevenuePerDay;
            entry.dailyRevenue = computed.dailyRevenue;
            entry.lastComputedAt = new Date();
            entry.targetHistory = entry.targetHistory || [];
            entry.targetHistory.push({ target, changedAt: new Date(), achievement: computed.achievedRevenue });
            current.metrics.performance[key] = entry;
            payload = entry;
            return current;
        });
        return res.json(payload);
    } catch (err) {
        console.error('Failed to set target:', err);
        res.status(500).json({ error: 'Failed to set target' });
    }
});

module.exports = router;
