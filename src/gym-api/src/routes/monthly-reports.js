const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const MonthlyRegistration = require('../models/MonthlyRegistration');
const MonthlyTrialAttended = require('../models/MonthlyTrialAttended');
const { readDb, writeDb } = require('../storage');

const router = express.Router();

/**
 * Get monthly trial attended leads and new members data
 * Supports querying by year and month
 * Returns paginated data with historical tracking
 */

// Helper to get month date range
const getMonthRange = (year, month) => {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
};

// GET /api/monthly-reports/trial-attended
// Returns trial attended leads for a specific month
router.get('/trial-attended', async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.query.year) || now.getUTCFullYear();
        const month = Number(req.query.month) || (now.getUTCMonth() + 1);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

        const { start, end } = getMonthRange(year, month);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // First, try to get archived data
            const archived = await MonthlyTrialAttended.findOne({ year, month });

            if (archived && archived.isArchived) {
                // Return permanent archived data
                const totalCount = archived.totalCount;
                const startIndex = (page - 1) * limit;
                const paginatedLeads = archived.leads
                    .slice()
                    .sort((a, b) => new Date(b.trialAttendedAt || b.createdAt) - new Date(a.trialAttendedAt || a.createdAt))
                    .slice(startIndex, startIndex + limit);

                return res.json({
                    year,
                    month,
                    totalCount,
                    page,
                    limit,
                    totalPages: Math.ceil(totalCount / limit),
                    leads: paginatedLeads,
                    data: paginatedLeads,
                    isArchived: true
                });
            }

            // Not archived or current month: query live data then filter by effective "trial attended" timestamp
            const baseQuery = { status: /trial attended/i };
            const allTrialLeads = await Lead.find(baseQuery).lean();

            // Effective date preference: trialAttendedAt (if present) -> updatedAt -> createdAt
            const inMonthLeads = allTrialLeads.filter(lead => {
                const effectiveDate = new Date(lead.trialAttendedAt || lead.updatedAt || lead.createdAt);
                return effectiveDate >= start && effectiveDate <= end;
            });

            // Sort by effective date desc
            inMonthLeads.sort((a, b) => new Date(b.trialAttendedAt || b.updatedAt || b.createdAt) - new Date(a.trialAttendedAt || a.updatedAt || a.createdAt));

            const totalCount = inMonthLeads.length;
            const startIndex = (page - 1) * limit;
            const paginatedLeads = inMonthLeads.slice(startIndex, startIndex + limit);

            // If we have archived record (but not marked as archived yet), merge with live data
            if (archived) {
                const existingIds = new Set(archived.leads.map(l => l.leadId?.toString()));
                const newLeads = inMonthLeads.filter(l => !existingIds.has(l._id.toString()));

                if (newLeads.length > 0) {
                    const leadsToAdd = newLeads.map(lead => ({
                        leadId: lead._id,
                        name: lead.name,
                        phone: lead.phone,
                        email: lead.email,
                        interest: lead.interest,
                        plan: lead.plan,
                        leadSource: lead.leadSource || lead.source,
                        source: lead.source,
                        status: lead.status,
                        trialAttendedAt: lead.trialAttendedAt || lead.updatedAt || lead.createdAt,
                        createdAt: lead.createdAt,
                        notes: lead.notes,
                        remarks: lead.remarks,
                        archivedAt: new Date()
                    }));

                    archived.leads.push(...leadsToAdd);
                    archived.totalCount = archived.leads.length;
                    await archived.save();
                }
            } else {
                // Create new archive record for this month using the full in-month set
                const leadsSnapshot = inMonthLeads.map(lead => ({
                    leadId: lead._id,
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email,
                    interest: lead.interest,
                    plan: lead.plan,
                    leadSource: lead.leadSource || lead.source,
                    source: lead.source,
                    status: lead.status,
                    trialAttendedAt: lead.trialAttendedAt || lead.updatedAt || lead.createdAt,
                    createdAt: lead.createdAt,
                    notes: lead.notes,
                    remarks: lead.remarks,
                    archivedAt: new Date()
                }));

                await MonthlyTrialAttended.create({
                    year,
                    month,
                    leads: leadsSnapshot,
                    totalCount: leadsSnapshot.length,
                    isArchived: false
                });
            }

            return res.json({
                year,
                month,
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                leads: paginatedLeads,
                data: paginatedLeads,
                isArchived: false
            });
        }

        // File storage fallback
        const data = readDb();
        const allLeads = Array.isArray(data.leads) ? data.leads : [];

        const filteredLeads = allLeads.filter(lead => {
            if (!lead.status || !String(lead.status).toLowerCase().includes('trial attended')) {
                return false;
            }
            const effective = new Date(lead.trialAttendedAt || lead.updatedAt || lead.createdAt);
            return effective >= start && effective <= end;
        });

        const totalCount = filteredLeads.length;
        const startIndex = (page - 1) * limit;
        const paginatedLeads = filteredLeads
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(startIndex, startIndex + limit);

        return res.json({
            year,
            month,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            leads: paginatedLeads,
            data: paginatedLeads,
            isArchived: false
        });
    } catch (error) {
        console.error('Error fetching trial attended leads:', error);
        res.status(500).json({ error: 'Failed to fetch trial attended leads' });
    }
});

// POST /api/monthly-reports/archive-trial-attended
// Archives trial attended leads for a specific month permanently
// Body: { year: 2025, month: 10 }
router.post('/archive-trial-attended', async (req, res) => {
    try {
        const { year, month } = req.body;

        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Valid year and month (1-12) required' });
        }

        const { start, end } = getMonthRange(year, month);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Check if already archived
            let monthlyTrialAttendedRecord = await MonthlyTrialAttended.findOne({ year, month });

            if (monthlyTrialAttendedRecord && monthlyTrialAttendedRecord.isArchived) {
                return res.status(200).json({
                    message: 'Month already archived',
                    year,
                    month,
                    totalCount: monthlyTrialAttendedRecord.totalCount,
                    archivedAt: monthlyTrialAttendedRecord.archivedAt
                });
            }

            // Find all trial attended leads in this month
            const allTrialAttended = await Lead.find({
                status: /trial attended/i
            }).lean();

            const monthlyTrialAttendedLeads = allTrialAttended.filter(lead => {
                const createdAt = new Date(lead.createdAt);
                return createdAt >= start && createdAt <= end;
            });

            // Create snapshot of each lead
            const leadSnapshots = monthlyTrialAttendedLeads.map(lead => ({
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                interest: lead.interest,
                plan: lead.plan,
                leadSource: lead.leadSource || lead.source,
                source: lead.source,
                status: lead.status,
                createdAt: lead.createdAt,
                archivedAt: new Date()
            }));

            // Create or update monthly trial attended record
            if (monthlyTrialAttendedRecord) {
                monthlyTrialAttendedRecord.leads = leadSnapshots;
                monthlyTrialAttendedRecord.isArchived = true;
                monthlyTrialAttendedRecord.archivedAt = new Date();
            } else {
                monthlyTrialAttendedRecord = new MonthlyTrialAttended({
                    year,
                    month,
                    leads: leadSnapshots,
                    isArchived: true,
                    archivedAt: new Date()
                });
            }

            await monthlyTrialAttendedRecord.save();

            return res.json({
                success: true,
                message: 'Trial attended leads archived successfully',
                year,
                month,
                totalCount: leadSnapshots.length,
                archivedAt: monthlyTrialAttendedRecord.archivedAt
            });
        } else {
            // File storage fallback
            const data = readDb();

            // Initialize if not exists
            if (!data.monthlyTrialAttended) {
                data.monthlyTrialAttended = [];
            }

            // Check if already archived
            const existingIndex = data.monthlyTrialAttended.findIndex(
                record => record.year === year && record.month === month
            );

            if (existingIndex >= 0 && data.monthlyTrialAttended[existingIndex].isArchived) {
                return res.status(200).json({
                    message: 'Month already archived',
                    year,
                    month,
                    totalCount: data.monthlyTrialAttended[existingIndex].totalCount,
                    archivedAt: data.monthlyTrialAttended[existingIndex].archivedAt
                });
            }

            // Find all trial attended leads in this month
            const allLeads = Array.isArray(data.leads) ? data.leads : [];
            const monthlyTrialAttended = allLeads.filter(lead => {
                if (!lead.status || !lead.status.toLowerCase().includes('trial attended')) {
                    return false;
                }
                const createdAt = new Date(lead.createdAt);
                return createdAt >= start && createdAt <= end;
            });

            // Create snapshot
            const leadSnapshots = monthlyTrialAttended.map(lead => ({
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                interest: lead.interest,
                plan: lead.plan,
                leadSource: lead.leadSource || lead.source,
                source: lead.source,
                status: lead.status,
                createdAt: lead.createdAt,
                archivedAt: new Date().toISOString()
            }));

            // Create or update archive record
            const archiveRecord = {
                year,
                month,
                leads: leadSnapshots,
                totalCount: leadSnapshots.length,
                isArchived: true,
                archivedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                data.monthlyTrialAttended[existingIndex] = archiveRecord;
            } else {
                data.monthlyTrialAttended.push(archiveRecord);
            }

            writeDb(data);

            return res.json({
                success: true,
                message: 'Trial attended leads archived successfully',
                year,
                month,
                totalCount: leadSnapshots.length,
                archivedAt: archiveRecord.archivedAt
            });
        }
    } catch (error) {
        console.error('Error archiving trial attended leads:', error);
        res.status(500).json({ error: 'Failed to archive trial attended leads' });
    }
});

// GET /api/monthly-reports/new-members
// Returns new members (converted leads) for a specific month
// Uses archived snapshots for permanent storage
router.get('/new-members', async (req, res) => {
    try {
        const now = new Date();
        const year = Number(req.query.year) || now.getUTCFullYear();
        const month = Number(req.query.month) || (now.getUTCMonth() + 1);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

        const { start, end } = getMonthRange(year, month);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // First, try to get archived data
            const archived = await MonthlyRegistration.findOne({ year, month });

            if (archived && archived.isArchived) {
                // Return permanent archived data
                const totalCount = archived.totalCount;
                const startIndex = (page - 1) * limit;
                const paginatedLeads = archived.leads.slice(startIndex, startIndex + limit);

                return res.json({
                    year,
                    month,
                    totalCount,
                    page,
                    limit,
                    totalPages: Math.ceil(totalCount / limit),
                    data: paginatedLeads,
                    archived: true,
                    archivedAt: archived.archivedAt
                });
            }

            // Fall back to live query for current/recent months
            const query = {
                status: /converted/i
            };

            const allConverted = await Lead.find(query).lean();

            // Filter by conversion date (use convertedAt or createdAt)
            const monthlyConverted = allConverted.filter(lead => {
                const conversionDate = lead.convertedAt
                    ? new Date(lead.convertedAt)
                    : new Date(lead.createdAt);
                return conversionDate >= start && conversionDate <= end;
            });

            const totalCount = monthlyConverted.length;
            const startIndex = (page - 1) * limit;
            const paginatedLeads = monthlyConverted
                .sort((a, b) => {
                    const aDate = new Date(a.convertedAt || a.createdAt);
                    const bDate = new Date(b.convertedAt || b.createdAt);
                    return bDate - aDate;
                })
                .slice(startIndex, startIndex + limit);

            return res.json({
                year,
                month,
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                data: paginatedLeads,
                archived: false
            });
        }

        // File storage fallback
        const data = readDb();

        // Check for archived data in file storage
        const monthlyRegs = Array.isArray(data.monthlyRegistrations) ? data.monthlyRegistrations : [];
        const archived = monthlyRegs.find(reg => reg.year === year && reg.month === month && reg.isArchived);

        if (archived) {
            const totalCount = archived.totalCount;
            const startIndex = (page - 1) * limit;
            const paginatedLeads = archived.leads.slice(startIndex, startIndex + limit);

            return res.json({
                year,
                month,
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                data: paginatedLeads,
                archived: true,
                archivedAt: archived.archivedAt
            });
        }

        // Fall back to live query
        const allLeads = Array.isArray(data.leads) ? data.leads : [];

        const filteredLeads = allLeads.filter(lead => {
            if (!lead.status || lead.status.toLowerCase() !== 'converted') {
                return false;
            }
            const conversionDate = lead.convertedAt
                ? new Date(lead.convertedAt)
                : new Date(lead.createdAt);
            return conversionDate >= start && conversionDate <= end;
        });

        const totalCount = filteredLeads.length;
        const startIndex = (page - 1) * limit;
        const paginatedLeads = filteredLeads
            .sort((a, b) => {
                const aDate = new Date(a.convertedAt || a.createdAt);
                const bDate = new Date(b.convertedAt || b.createdAt);
                return bDate - aDate;
            })
            .slice(startIndex, startIndex + limit);

        return res.json({
            year,
            month,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            data: paginatedLeads,
            archived: false
        });
    } catch (error) {
        console.error('Error fetching new members:', error);
        res.status(500).json({ error: 'Failed to fetch new members' });
    }
});

// GET /api/monthly-reports/summary
// Returns summary data for all available months
router.get('/summary', async (req, res) => {
    try {
        const yearsBack = Number(req.query.yearsBack) || 10; // Default 10 years of history
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth() + 1;

        const summary = [];

        // Generate summary for last N years
        for (let year = currentYear; year >= currentYear - yearsBack; year--) {
            const startMonth = (year === currentYear) ? currentMonth : 12;

            for (let month = startMonth; month >= 1; month--) {
                const { start, end } = getMonthRange(year, month);

                let trialCount = 0;
                let newMembersCount = 0;

                if (mongoose.connection && mongoose.connection.readyState === 1) {
                    // MongoDB query
                    trialCount = await Lead.countDocuments({
                        status: /trial attended/i,
                        createdAt: { $gte: start, $lte: end }
                    });

                    const allConverted = await Lead.find({
                        status: /converted/i
                    }).lean();

                    newMembersCount = allConverted.filter(lead => {
                        const conversionDate = lead.convertedAt
                            ? new Date(lead.convertedAt)
                            : new Date(lead.createdAt);
                        return conversionDate >= start && conversionDate <= end;
                    }).length;
                } else {
                    // File storage fallback
                    const data = readDb();
                    const allLeads = Array.isArray(data.leads) ? data.leads : [];

                    trialCount = allLeads.filter(lead => {
                        if (!lead.status || !lead.status.toLowerCase().includes('trial attended')) {
                            return false;
                        }
                        const createdAt = new Date(lead.createdAt);
                        return createdAt >= start && createdAt <= end;
                    }).length;

                    newMembersCount = allLeads.filter(lead => {
                        if (!lead.status || lead.status.toLowerCase() !== 'converted') {
                            return false;
                        }
                        const conversionDate = lead.convertedAt
                            ? new Date(lead.convertedAt)
                            : new Date(lead.createdAt);
                        return conversionDate >= start && conversionDate <= end;
                    }).length;
                }

                // Only include months with data
                if (trialCount > 0 || newMembersCount > 0) {
                    summary.push({
                        year,
                        month,
                        trialAttendedCount: trialCount,
                        newMembersCount: newMembersCount
                    });
                }
            }
        }

        return res.json({
            summary,
            yearsBack
        });
    } catch (error) {
        console.error('Error fetching monthly summary:', error);
        res.status(500).json({ error: 'Failed to fetch monthly summary' });
    }
});

// POST /api/monthly-reports/archive
// Archives converted leads for a specific month permanently
// Body: { year: 2025, month: 10 }
router.post('/archive', async (req, res) => {
    try {
        const { year, month } = req.body;

        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Valid year and month (1-12) required' });
        }

        const { start, end } = getMonthRange(year, month);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Check if already archived
            let monthlyReg = await MonthlyRegistration.findOne({ year, month });

            if (monthlyReg && monthlyReg.isArchived) {
                return res.status(200).json({
                    message: 'Month already archived',
                    year,
                    month,
                    totalCount: monthlyReg.totalCount,
                    archivedAt: monthlyReg.archivedAt
                });
            }

            // Find all converted leads in this month
            const allConverted = await Lead.find({
                status: /converted/i
            }).lean();

            const monthlyConverted = allConverted.filter(lead => {
                const conversionDate = lead.convertedAt
                    ? new Date(lead.convertedAt)
                    : new Date(lead.createdAt);
                return conversionDate >= start && conversionDate <= end;
            });

            // Create snapshot of each lead
            const leadSnapshots = monthlyConverted.map(lead => ({
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                interest: lead.interest,
                plan: lead.plan,
                leadSource: lead.leadSource || lead.source,
                source: lead.source,
                status: lead.status,
                convertedAt: lead.convertedAt,
                createdAt: lead.createdAt,
                membership: lead.membership ? {
                    planLabel: lead.membership.planLabel,
                    amount: lead.membership.amount,
                    duration: lead.membership.duration,
                    startDate: lead.membership.startDate,
                    endDate: lead.membership.endDate
                } : undefined,
                joinDate: lead.joinDate || lead.membership?.startDate,
                expiryDate: lead.expiryDate || lead.membership?.endDate,
                archivedAt: new Date()
            }));

            // Create or update monthly registration
            if (monthlyReg) {
                monthlyReg.leads = leadSnapshots;
                monthlyReg.isArchived = true;
                monthlyReg.archivedAt = new Date();
            } else {
                monthlyReg = new MonthlyRegistration({
                    year,
                    month,
                    leads: leadSnapshots,
                    isArchived: true,
                    archivedAt: new Date()
                });
            }

            await monthlyReg.save();

            return res.json({
                message: 'Month archived successfully',
                year,
                month,
                totalCount: monthlyReg.totalCount,
                archivedAt: monthlyReg.archivedAt
            });
        }

        // File storage fallback
        const data = readDb();

        // Initialize monthlyRegistrations if needed
        if (!Array.isArray(data.monthlyRegistrations)) {
            data.monthlyRegistrations = [];
        }

        // Check if already archived
        const existingIndex = data.monthlyRegistrations.findIndex(
            reg => reg.year === year && reg.month === month
        );

        if (existingIndex >= 0 && data.monthlyRegistrations[existingIndex].isArchived) {
            return res.status(200).json({
                message: 'Month already archived',
                year,
                month,
                totalCount: data.monthlyRegistrations[existingIndex].totalCount,
                archivedAt: data.monthlyRegistrations[existingIndex].archivedAt
            });
        }

        // Find all converted leads
        const allLeads = Array.isArray(data.leads) ? data.leads : [];
        const monthlyConverted = allLeads.filter(lead => {
            if (!lead.status || lead.status.toLowerCase() !== 'converted') {
                return false;
            }
            const conversionDate = lead.convertedAt
                ? new Date(lead.convertedAt)
                : new Date(lead.createdAt);
            return conversionDate >= start && conversionDate <= end;
        });

        // Create snapshot
        const leadSnapshots = monthlyConverted.map(lead => ({
            leadId: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            interest: lead.interest,
            plan: lead.plan,
            leadSource: lead.leadSource || lead.source,
            source: lead.source,
            status: lead.status,
            convertedAt: lead.convertedAt,
            createdAt: lead.createdAt,
            membership: lead.membership,
            joinDate: lead.joinDate || lead.membership?.startDate,
            expiryDate: lead.expiryDate || lead.membership?.endDate,
            archivedAt: new Date().toISOString()
        }));

        const archive = {
            year,
            month,
            leads: leadSnapshots,
            totalCount: leadSnapshots.length,
            isArchived: true,
            archivedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            data.monthlyRegistrations[existingIndex] = archive;
        } else {
            data.monthlyRegistrations.push(archive);
        }

        writeDb(data);

        return res.json({
            message: 'Month archived successfully',
            year,
            month,
            totalCount: archive.totalCount,
            archivedAt: archive.archivedAt
        });
    } catch (error) {
        console.error('Error archiving month:', error);
        res.status(500).json({ error: 'Failed to archive month' });
    }
});

// POST /api/monthly-reports/auto-archive
// Automatically archives the previous month's data
router.post('/auto-archive', async (req, res) => {
    try {
        const now = new Date();
        // Archive previous month
        const prevMonth = now.getMonth(); // 0-based, so current-1 in array terms
        const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const month = prevMonth === 0 ? 12 : prevMonth;

        // Call the archive endpoint logic
        const archiveReq = { body: { year: prevYear, month } };
        const archiveRes = {
            status: (code) => ({
                json: (data) => res.status(code).json(data)
            }),
            json: (data) => res.json(data)
        };

        // Re-use archive logic
        return router.stack.find(layer =>
            layer.route?.path === '/archive' && layer.route?.methods?.post
        )?.route?.stack[0]?.handle(archiveReq, archiveRes);

    } catch (error) {
        console.error('Error in auto-archive:', error);
        res.status(500).json({ error: 'Failed to auto-archive' });
    }
});

module.exports = router;
