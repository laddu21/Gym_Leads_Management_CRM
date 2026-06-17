const express = require('express');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Membership = require('../models/Membership');
const MembershipHistory = require('../models/MembershipHistory');
const Lead = require('../models/Lead');
const { readDb, updateDb } = require('../storage');

const router = express.Router();

const CATEGORY_ALIASES = {
    normal: ['normal', 'standard', 'basic'],
    premium: ['premium', 'vip', 'elite']
};

const canonicalCategory = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return '';
    }
    const lower = trimmed.toLowerCase();
    for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
        // match either known aliases (e.g. 'vip') or the canonical name itself (e.g. 'premium')
        if (aliases.includes(lower) || canonical === lower) {
            return canonical;
        }
    }
    // allow freeform categories (frontend often uses values like "Monthly")
    return trimmed;
};

const categoriesMatch = (planCategory, requestedCategory) => {
    if (!requestedCategory) {
        return true;
    }
    const target = canonicalCategory(requestedCategory);
    const current = canonicalCategory(planCategory);
    return current.toLowerCase() === target.toLowerCase();
};

const parsePrice = (value) => {
    // Accept numbers directly
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    // Treat empty or null as missing
    if (value === null || value === undefined || value === '') {
        return null;
    }

    // Normalize common human-entered numeric formats: remove currency symbols, commas and spaces
    try {
        const str = String(value).trim();
        // Remove common currency symbols and thousands separators
        const cleaned = str.replace(/[$£€₹¥₨,\s]/g, '');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    } catch (err) {
        return null;
    }
};

// Normalize a membership document (Mongoose doc or plain object) to the API shape
const toApiMembership = (m) => {
    if (!m) return null;
    const id = m.id || (m._id ? String(m._id) : undefined);
    return {
        id,
        name: m.name || '',
        phone: m.phone || '',
        email: m.email || '',
        category: m.category || '',
        label: m.label || '',
        price: m.price != null ? m.price : null,
        original: m.original != null ? m.original : null,
        tag: m.tag != null ? m.tag : null,
        preferredDate: m.preferredDate || null,
        paymentMode: m.paymentMode || '',
        remarks: m.remarks || '',
        createdAt: m.createdAt || m.created_at || null,
        updatedAt: m.updatedAt || m.updated_at || null
    };
};

router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        // Prefer MongoDB when available; fall back to file-backed storage (db.json)
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            let query = {};
            if (category) {
                query.category = canonicalCategory(category);
            }
            const memberships = await Membership.find(query).sort({ createdAt: -1 });
            return res.json(memberships.map(toApiMembership));
        }

        // File-storage fallback
        const data = readDb();
        const list = Array.isArray(data.memberships) ? data.memberships.slice().reverse() : [];
        const filtered = category ? list.filter((m) => categoriesMatch(m.category, category)) : list;
        res.json(filtered.map(toApiMembership));
    } catch (error) {
        console.error('Error fetching memberships:', error);
        res.status(500).json({ error: 'Failed to fetch memberships' });
    }
});

// Return recent membership change history (used by admin UI)
router.get('/history', async (req, res) => {
    try {
        let limit = Number(req.query.limit) || 25;
        if (!Number.isFinite(limit) || limit <= 0) limit = 25;
        limit = Math.min(limit, 100);
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const history = await MembershipHistory.find({}).sort({ occurredAt: -1 }).limit(limit);
            const mapped = history.map((h) => ({
                id: h.id || (h._id ? String(h._id) : undefined),
                membershipId: h.membershipId ? String(h.membershipId) : null,
                membershipLabel: h.membershipLabel || null,
                action: h.action,
                amount: h.amount || null,
                paymentMode: h.paymentMode || null,
                changes: h.changes || {},
                occurredAt: h.occurredAt || h.createdAt || null
            }));
            return res.json(mapped);
        }

        // File-storage fallback
        const data = readDb();
        const historyList = Array.isArray(data.membershipHistory) ? data.membershipHistory : [];
        const mapped = historyList.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, limit).map((h) => ({
            id: h.id || h._id || null,
            membershipId: h.membershipId || null,
            membershipLabel: h.membershipLabel || null,
            action: h.action,
            amount: h.amount || null,
            paymentMode: h.paymentMode || null,
            changes: h.changes || {},
            occurredAt: h.occurredAt || h.createdAt || null
        }));
        res.json(mapped);
    } catch (error) {
        console.error('Error fetching membership history:', error);
        res.status(500).json({ error: 'Failed to fetch membership history' });
    }
});

// Return membership history for a specific membership id
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        let limit = Number(req.query.limit) || 50;
        if (!Number.isFinite(limit) || limit <= 0) limit = 50;
        limit = Math.min(limit, 200);

        // optional offset for simple pagination
        let offset = Number(req.query.offset) || 0;
        if (!Number.isFinite(offset) || offset < 0) offset = 0;

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Validate membership exists (by _id or legacy custom id)
            let membership = null;
            if (mongoose.isValidObjectId(id)) {
                membership = await Membership.findById(id).select(['_id', 'label']).lean();
            }
            if (!membership) {
                membership = await Membership.findOne({ id }).select(['_id', 'label']).lean();
            }
            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' });
            }

            const query = { membershipId: membership._id };
            const history = await MembershipHistory.find(query)
                .sort({ occurredAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean();

            const mapped = history.map((h) => ({
                id: h.id || (h._id ? String(h._id) : undefined),
                membershipId: h.membershipId ? String(h.membershipId) : null,
                membershipLabel: h.membershipLabel || membership.label || null,
                action: h.action,
                amount: h.amount || null,
                paymentMode: h.paymentMode || null,
                changes: h.changes || {},
                occurredAt: h.occurredAt || h.createdAt || null
            }));
            return res.json({
                data: mapped,
                page: { limit, offset, count: mapped.length }
            });
        }

        // File-storage fallback
        const data = readDb();
        const memberships = Array.isArray(data.memberships) ? data.memberships : [];
        const match = memberships.find((m) => String(m.id || m._id) === String(id));
        if (!match) {
            return res.status(404).json({ error: 'Membership not found' });
        }

        const allHistory = Array.isArray(data.membershipHistory) ? data.membershipHistory : [];
        const list = allHistory
            .filter((h) => String(h.membershipId) === String(match.id || match._id))
            .sort((a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt));

        const paged = list.slice(offset, offset + limit).map((h) => ({
            id: h.id || h._id || null,
            membershipId: h.membershipId || null,
            membershipLabel: h.membershipLabel || match.label || null,
            action: h.action,
            amount: h.amount || null,
            paymentMode: h.paymentMode || null,
            changes: h.changes || {},
            occurredAt: h.occurredAt || h.createdAt || null
        }));

        res.json({ data: paged, page: { limit, offset, count: paged.length } });
    } catch (error) {
        console.error('Error fetching membership history by id:', error);
        res.status(500).json({ error: 'Failed to fetch membership history for id' });
    }
});

// Return membership history for a specific phone (combines all memberships with that phone)
router.get('/history/by-phone', async (req, res) => {
    try {
        const rawPhone = (req.query.phone || '').toString().trim();
        if (!rawPhone) {
            return res.status(400).json({ error: 'phone query param is required' });
        }
        let limit = Number(req.query.limit) || 500;
        if (!Number.isFinite(limit) || limit <= 0) limit = 500;
        limit = Math.min(limit, 2000);

        const normalizePhone = (v = '') => v.replace(/\D/g, '').slice(-10);
        const phoneKey = normalizePhone(rawPhone);

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Find all memberships for this phone (current and historical via history)
            const memberships = await Membership.find({}).select(['_id', 'phone', 'label']).lean();
            const currentIds = memberships
                .filter((m) => normalizePhone(m.phone || '') === phoneKey)
                .map((m) => m._id);

            // Also find membershipIds from history records where the phone matches in changes
            const historicalHistory = await MembershipHistory.find({
                'changes.phone': { $exists: true }
            }).select(['membershipId', 'changes.phone']).lean();
            const historicalIds = historicalHistory
                .filter((h) => normalizePhone(h.changes.phone || '') === phoneKey)
                .map((h) => h.membershipId);

            const allIds = [...new Set([...currentIds, ...historicalIds])];

            if (allIds.length === 0) {
                return res.json([]);
            }

            const history = await MembershipHistory.find({ membershipId: { $in: allIds } })
                .sort({ occurredAt: -1 })
                .limit(limit)
                .lean();

            const mapped = history.map((h) => ({
                id: h.id || (h._id ? String(h._id) : undefined),
                membershipId: h.membershipId ? String(h.membershipId) : null,
                membershipLabel: h.membershipLabel || null,
                action: h.action,
                amount: h.amount || null,
                paymentMode: h.paymentMode || null,
                changes: h.changes || {},
                occurredAt: h.occurredAt || h.createdAt || null
            }));
            return res.json(mapped);
        }

        // File-storage fallback
        const data = readDb();
        const allMemberships = Array.isArray(data.memberships) ? data.memberships : [];
        const targetIds = new Set(
            allMemberships
                .filter((m) => normalizePhone(m.phone || '') === phoneKey)
                .map((m) => String(m.id || m._id))
        );

        // Also add ids from history where phone matches in changes
        const historyList = Array.isArray(data.membershipHistory) ? data.membershipHistory : [];
        historyList.forEach((h) => {
            if (h.changes && h.changes.phone && normalizePhone(h.changes.phone) === phoneKey) {
                targetIds.add(String(h.membershipId));
            }
        });

        if (targetIds.size === 0) {
            return res.json([]);
        }
        const mapped = historyList
            .filter((h) => h.membershipId && targetIds.has(String(h.membershipId)))
            .sort((a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt))
            .slice(0, limit)
            .map((h) => ({
                id: h.id || h._id || null,
                membershipId: h.membershipId || null,
                membershipLabel: h.membershipLabel || null,
                action: h.action,
                amount: h.amount || null,
                paymentMode: h.paymentMode || null,
                changes: h.changes || {},
                occurredAt: h.occurredAt || h.createdAt || null
            }));
        res.json(mapped);
    } catch (error) {
        console.error('Error fetching membership history by phone:', error);
        res.status(500).json({ error: 'Failed to fetch membership history by phone' });
    }
});

// Clear all membership history (admin action)
router.delete('/history', async (req, res) => {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            await MembershipHistory.deleteMany({});
            return res.json({ success: true });
        }

        updateDb((current) => {
            current.membershipHistory = [];
            return current;
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to clear membership history:', error);
        res.status(500).json({ error: 'Failed to clear membership history' });
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('POST /api/memberships called with body:', req.body);
        const rawName = req.body.name || '';
        const rawPhone = req.body.phone || '';
        const rawEmail = req.body.email || '';
        const rawCategory = req.body.category || req.body.planCategory || '';
        const rawLabel = req.body.label || req.body.planLabel || '';
        const parsedPrice = parsePrice(req.body.price || req.body.amount);
        const preferredDate = req.body.preferredDate ? new Date(req.body.preferredDate) : null;
        // Only accept paymentMode when it's a non-empty string; otherwise omit it to satisfy enum
        const paymentMode = (typeof req.body.paymentMode === 'string' && req.body.paymentMode.trim())
            ? req.body.paymentMode.trim()
            : undefined;
        const remarks = req.body.remarks || '';

        console.log('Parsed values:', { rawName, rawPhone, rawEmail, rawCategory, rawLabel, parsedPrice, preferredDate, paymentMode, remarks });

        // Support "plan template" creation from admin: if name/phone are missing but
        // category, label and price are present, auto-fill safe placeholders and
        // skip lead creation below. This keeps backward compatibility for real
        // membership creation while allowing the admin UI to manage a pricing catalog.
        let isTemplate = false;
        let nameVal = (rawName || '').trim();
        let phoneVal = (rawPhone || '').trim();
        const hasPlanCore = !!rawCategory.trim() && !!rawLabel.trim() && parsedPrice !== null;

        if ((!nameVal || !phoneVal) && hasPlanCore) {
            isTemplate = true;
            if (!nameVal) nameVal = 'Plan Template';
            if (!phoneVal) phoneVal = '0000000000';
        }

        if (!nameVal || !phoneVal || !hasPlanCore) {
            console.log('Validation failed: missing required fields');
            return res.status(400).json({ error: 'name, phone, category, label and price are required' });
        }

        const parsedOriginal = parsePrice(req.body.original);
        const tag = typeof req.body.tag === 'string' && req.body.tag.trim() ? req.body.tag.trim() : null;

        const categoryValue = canonicalCategory(rawCategory) || rawCategory.trim();

        // Prefer MongoDB but fall back to file-backed storage if unavailable
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const membershipDoc = {
                name: nameVal,
                phone: phoneVal,
                email: rawEmail.trim(),
                category: categoryValue,
                label: rawLabel.trim(),
                price: parsedPrice,
                original: parsedOriginal,
                tag,
                preferredDate,
                remarks: remarks.trim()
            };
            if (paymentMode !== undefined) {
                membershipDoc.paymentMode = paymentMode;
            }

            const membership = new Membership(membershipDoc);

            try {
                await membership.save();
            } catch (saveError) {
                console.error('Validation error creating membership:', saveError);
                if (saveError.name === 'ValidationError') {
                    const details = Object.keys(saveError.errors || {}).reduce((acc, key) => {
                        acc[key] = saveError.errors[key].message;
                        return acc;
                    }, {});
                    return res.status(400).json({ error: 'Validation failed', details });
                }
                throw saveError;
            }

            // Create or update corresponding lead
            try {
                // Skip lead sync for template entries identified by placeholder phone
                if (!isTemplate && phoneVal !== '0000000000') {
                    const leadData = {
                        name: membership.name,
                        phone: membership.phone,
                        email: membership.email || '',
                        source: 'Membership Created',
                        interest: `${membership.category} - ${membership.label}`,
                        status: 'Converted',
                        followUpDate: membership.preferredDate || new Date(),
                        notes: `Membership created: ${membership.label} (${membership.category}) - ${membership.remarks || ''}`.trim(),
                        membership: {
                            plan: membership.label,
                            planCategory: membership.category,
                            amount: membership.price,
                            paymentMode: membership.paymentMode,
                            preferredDate: membership.preferredDate,
                            remarks: membership.remarks
                        },
                        convertedAt: new Date()
                    };

                    // Try to update existing lead
                    let lead = await Lead.findOne({ phone: membership.phone });
                    if (lead) {
                        lead.status = 'Converted';
                        lead.membership = leadData.membership;
                        lead.convertedAt = leadData.convertedAt;
                        lead.notes = leadData.notes;
                        await lead.save();
                    } else {
                        // Create new lead
                        lead = new Lead(leadData);
                        await lead.save();
                    }
                }
            } catch (leadError) {
                console.error('Failed to create/update lead:', leadError);
                // Don't fail the membership creation
            }

            // Record change history
            try {
                await MembershipHistory.create({
                    membershipId: membership._id,
                    membershipLabel: membership.label,
                    action: 'create',
                    amount: membership.price,  // Store amount at top level for easy access
                    paymentMode: membership.paymentMode,  // Store paymentMode at top level
                    changes: {
                        name: membership.name,
                        phone: membership.phone,
                        email: membership.email,
                        category: membership.category,
                        label: membership.label,
                        price: membership.price,
                        original: membership.original,
                        tag: membership.tag,
                        preferredDate: membership.preferredDate,
                        paymentMode: membership.paymentMode,
                        remarks: membership.remarks
                    },
                    occurredAt: new Date()
                });
            } catch (histErr) {
                console.error('Failed to record membership history:', histErr);
            }

            return res.status(201).json({ data: toApiMembership(membership) });
        }

        // File-storage create fallback
        const now = new Date().toISOString();
        const plan = {
            id: req.body.id || randomUUID(),
            name: nameVal,
            phone: phoneVal,
            email: rawEmail.trim(),
            category: categoryValue,
            label: rawLabel.trim(),
            price: parsedPrice,
            original: parsedOriginal,
            tag: tag || null,
            preferredDate: preferredDate ? preferredDate.toISOString() : null,
            // Only include paymentMode when present
            ...(paymentMode !== undefined ? { paymentMode } : {}),
            remarks: remarks.trim(),
            createdAt: now,
            updatedAt: now
        };

        updateDb((current) => {
            current.memberships = current.memberships || [];
            current.memberships.push(plan);
            current.membershipHistory = current.membershipHistory || [];
            current.membershipHistory.push({
                id: randomUUID(),
                membershipId: plan.id,
                membershipLabel: plan.label,
                action: 'create',
                amount: plan.price,  // Store amount at top level for easy access
                paymentMode: plan.paymentMode,  // Store paymentMode at top level
                changes: {
                    name: plan.name,
                    phone: plan.phone,
                    email: plan.email,
                    category: plan.category,
                    label: plan.label,
                    price: plan.price,
                    original: plan.original,
                    tag: plan.tag,
                    preferredDate: plan.preferredDate,
                    paymentMode: plan.paymentMode,
                    remarks: plan.remarks
                },
                occurredAt: now
            });

            // Create corresponding lead entry for real memberships only
            if (!isTemplate && plan.phone !== '0000000000') {
                current.leads = current.leads || [];
                const existingLeadIndex = current.leads.findIndex(lead => lead.phone === plan.phone);
                if (existingLeadIndex === -1) {
                    // Create new lead if one doesn't exist
                    const leadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const newLead = {
                        id: leadId,
                        name: plan.name,
                        phone: plan.phone,
                        email: plan.email || '',
                        source: 'Membership Created',
                        interest: `${plan.category} - ${plan.label}`,
                        status: 'Converted',
                        followUpDate: plan.preferredDate || now,
                        notes: `Membership created: ${plan.label} (${plan.category}) - ${plan.remarks || ''}`.trim(),
                        membership: {
                            plan: plan.label,
                            planCategory: plan.category,
                            amount: plan.price,
                            paymentMode: plan.paymentMode,
                            preferredDate: plan.preferredDate,
                            remarks: plan.remarks
                        },
                        convertedAt: now,
                        createdAt: now,
                        updatedAt: now
                    };
                    current.leads.push(newLead);
                } else {
                    // Update existing lead to Converted status with membership details
                    current.leads[existingLeadIndex].status = 'Converted';
                    current.leads[existingLeadIndex].membership = {
                        plan: plan.label,
                        planCategory: plan.category,
                        amount: plan.price,
                        paymentMode: plan.paymentMode,
                        preferredDate: plan.preferredDate,
                        remarks: plan.remarks
                    };
                    current.leads[existingLeadIndex].convertedAt = now;
                    current.leads[existingLeadIndex].updatedAt = now;
                    if (!current.leads[existingLeadIndex].notes) {
                        current.leads[existingLeadIndex].notes = `Membership created: ${plan.label} (${plan.category})`;
                    }
                }
            }

            return current;
        });

        res.status(201).json({ data: toApiMembership(plan) });
    } catch (error) {
        console.error('Error creating membership:', error);
        res.status(500).json({ error: 'Failed to create membership' });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label, tag, category } = req.body;
        const parsedPrice = parsePrice(req.body.price);
        const rawOriginal = req.body.original;
        const parsedOriginal = rawOriginal === null ? null : parsePrice(rawOriginal);

        if (req.body.price !== undefined && parsedPrice === null) {
            return res.status(400).json({ error: 'price must be a valid number' });
        }

        if (rawOriginal !== undefined && rawOriginal !== null && parsedOriginal === null) {
            return res.status(400).json({ error: 'original must be a valid number or null' });
        }

        const updateData = {};
        if (parsedPrice !== null) updateData.price = parsedPrice;
        if (rawOriginal !== undefined) updateData.original = rawOriginal === null ? null : parsedOriginal;
        if (typeof label === 'string' && label.trim()) updateData.label = label.trim();
        if (tag !== undefined) updateData.tag = typeof tag === 'string' && tag.trim() ? tag.trim() : null;
        if (typeof category === 'string' && category.trim()) updateData.category = canonicalCategory(category) || category.trim();

        // Prefer MongoDB update, fall back to file-backed storage
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Find existing to compute change set
            const existing = await Membership.findById(id);
            if (!existing) {
                return res.status(404).json({ error: 'Membership not found' });
            }

            let membership;
            try {
                membership = await Membership.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            } catch (updateErr) {
                console.error('Validation error updating membership:', updateErr);
                if (updateErr.name === 'ValidationError') {
                    const details = Object.keys(updateErr.errors || {}).reduce((acc, key) => {
                        acc[key] = updateErr.errors[key].message;
                        return acc;
                    }, {});
                    return res.status(400).json({ error: 'Validation failed', details });
                }
                throw updateErr;
            }

            // Compute changes between existing and updated document
            const trackedFields = ['label', 'tag', 'category', 'price', 'original'];
            const isSame = (a, b) => {
                if (a == null && b == null) return true;
                if (a == null || b == null) return false;
                if (typeof a === 'number' || typeof b === 'number') {
                    return Number(a) === Number(b);
                }
                return String(a) === String(b);
            };

            const changes = {};
            for (const field of trackedFields) {
                const before = existing[field] === undefined ? null : existing[field];
                const after = membership[field] === undefined ? null : membership[field];
                if (!isSame(before, after)) {
                    changes[field] = { from: before, to: after };
                }
            }

            if (Object.keys(changes).length > 0) {
                (async () => {
                    try {
                        await MembershipHistory.create({
                            membershipId: membership._id,
                            membershipLabel: membership.label,
                            action: 'update',
                            amount: membership.price,  // Store current amount
                            paymentMode: membership.paymentMode,  // Store current paymentMode
                            changes,
                            occurredAt: new Date()
                        });
                    } catch (histErr) {
                        console.error('Failed to record membership update history:', histErr);
                    }
                })();
            }

            return res.json({ data: toApiMembership(membership) });
        }

        // File-storage update fallback
        const data = readDb();
        const existingIndex = (data.memberships || []).findIndex((m) => (m.id === id || String(m._id) === String(id)));
        if (existingIndex === -1) {
            return res.status(404).json({ error: 'Membership not found' });
        }

        const before = { ...data.memberships[existingIndex] };
        const updated = { ...before, ...updateData, updatedAt: new Date().toISOString() };

        // Ensure numeric parsing for price/original
        if (updateData.price !== undefined) updated.price = updateData.price;
        if (updateData.original !== undefined) updated.original = updateData.original;

        updateDb((current) => {
            current.memberships[existingIndex] = updated;
            current.membershipHistory = current.membershipHistory || [];
            const changes = {};
            const trackedFields = ['label', 'tag', 'category', 'price', 'original'];
            trackedFields.forEach((field) => {
                const b = before[field] === undefined ? null : before[field];
                const a = updated[field] === undefined ? null : updated[field];
                if ((b == null && a != null) || (b != null && a == null) || String(b) !== String(a)) {
                    changes[field] = { from: b, to: a };
                }
            });

            if (Object.keys(changes).length > 0) {
                current.membershipHistory.push({
                    id: randomUUID(),
                    membershipId: updated.id,
                    membershipLabel: updated.label,
                    action: 'update',
                    amount: updated.price,  // Store current amount
                    paymentMode: updated.paymentMode,  // Store current paymentMode
                    changes,
                    occurredAt: new Date().toISOString()
                });
            }
            return current;
        });

        res.json({ data: toApiMembership(updated) });
    } catch (error) {
        console.error('Error updating membership:', error);
        res.status(500).json({ error: 'Failed to update membership' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Prefer MongoDB delete; fall back to file-storage if not connected
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Try by MongoDB _id first
            let membership = await Membership.findByIdAndDelete(id);

            // Fallback: some legacy documents or file-seeded entries use a custom `id` field — try deleting by that
            if (!membership) {
                membership = await Membership.findOneAndDelete({ id });
            }

            if (!membership) {
                return res.status(404).json({ error: 'Membership not found' });
            }

            // Record deletion in history (best-effort)
            (async () => {
                try {
                    await MembershipHistory.create({
                        membershipId: membership._id,
                        membershipLabel: membership.label,
                        action: 'delete',
                        changes: {},
                        occurredAt: new Date()
                    });
                } catch (histErr) {
                    console.error('Failed to record membership delete history:', histErr);
                }
            })();

            return res.json({ data: toApiMembership(membership) });
        }

        // File-storage delete fallback
        const data = readDb();
        const idx = (data.memberships || []).findIndex((m) => String(m.id) === String(id) || String(m._id) === String(id));
        if (idx === -1) {
            return res.status(404).json({ error: 'Membership not found' });
        }
        const removed = data.memberships.splice(idx, 1)[0];
        updateDb((current) => {
            current.memberships = data.memberships;
            current.membershipHistory = current.membershipHistory || [];
            current.membershipHistory.push({
                id: randomUUID(),
                membershipId: removed.id,
                membershipLabel: removed.label,
                action: 'delete',
                changes: {},
                occurredAt: new Date().toISOString()
            });
            return current;
        });

        res.json({ data: toApiMembership(removed) });
    } catch (error) {
        console.error('Error deleting membership:', error);
        res.status(500).json({ error: 'Failed to delete membership' });
    }
});

module.exports = router;
