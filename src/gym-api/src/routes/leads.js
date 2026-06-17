
const express = require('express');
const mongoose = require('mongoose');
const { readDb, updateDb } = require('../storage');
const LeadModel = require('../models/Lead');

const router = express.Router();
const { deriveExpiryIso } = require('../utils/planUtils');

// Helper to get days between two dates
function getDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Helper to paginate an array
function paginate(array, page = 1, pageSize = 5) {
    const total = array.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    return {
        data: array.slice(start, start + pageSize),
        total,
        totalPages,
        page,
        pageSize
    };
}

// GET /api/leads/expiring-soon?days=30&page=1&pageSize=5&month=YYYY-MM
router.get('/expiring-soon', async (req, res) => {
    const days = parseInt(req.query.days, 10) || 30;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 5;
    const month = req.query.month; // format: YYYY-MM
    const now = new Date();
    let leads = [];
    // Prefer MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        const docs = await LeadModel.find({}).lean();
        leads = docs;
    } else {
        leads = readDb().leads || [];
    }
    leads = leads.filter((lead) => {
        const expiry = lead.expiryDate || deriveExpiryIso({ ...lead, joinDate: lead.joinDate });
        if (!expiry) return false;
        const expiryDate = new Date(expiry);
        if (Number.isNaN(expiryDate.getTime())) return false;
        const diff = getDaysBetween(now, expiryDate);
        if (diff === null || diff <= 0 || diff > days) return false;
        if (month) {
            // Only include if expiry is in the given month
            const [y, m] = month.split('-').map(Number);
            if (expiryDate.getFullYear() !== y || (expiryDate.getMonth() + 1) !== m) return false;
        }
        return true;
    });
    // Sort by expiry date ascending
    leads.sort((a, b) => new Date(a.expiryDate || deriveExpiryIso({ ...a, joinDate: a.joinDate })) - new Date(b.expiryDate || deriveExpiryIso({ ...b, joinDate: b.joinDate })));
    return res.json(paginate(leads, page, pageSize));
});

// GET /api/leads/expired?page=1&pageSize=5&month=YYYY-MM
router.get('/expired', async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 5;
    const month = req.query.month; // format: YYYY-MM
    const now = new Date();
    let leads = [];
    // Prefer MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        const docs = await LeadModel.find({}).lean();
        leads = docs;
    } else {
        leads = readDb().leads || [];
    }
    leads = leads.filter((lead) => {
        const expiry = lead.expiryDate || deriveExpiryIso({ ...lead, joinDate: lead.joinDate });
        if (!expiry) return false;
        const expiryDate = new Date(expiry);
        if (Number.isNaN(expiryDate.getTime())) return false;
        if (expiryDate >= now) return false;
        if (month) {
            // Only include if expiry is in the given month
            const [y, m] = month.split('-').map(Number);
            if (expiryDate.getFullYear() !== y || (expiryDate.getMonth() + 1) !== m) return false;
        }
        return true;
    });
    // Sort by expiry date descending
    leads.sort((a, b) => new Date(b.expiryDate || deriveExpiryIso({ ...b, joinDate: b.joinDate })) - new Date(a.expiryDate || deriveExpiryIso({ ...a, joinDate: a.joinDate })));
    return res.json(paginate(leads, page, pageSize));
});

router.get('/', async (req, res) => {
    try {
        // Prefer MongoDB if connected; fallback to file storage
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const docs = await LeadModel.find({}).sort({ createdAt: -1 }).lean();
            const leadsWithDates = docs.map((lead) => {
                const joinDate = lead.joinDate || lead.membership?.startDate || lead.convertedAt || lead.createdAt || null;
                const expiryDate = lead.expiryDate || deriveExpiryIso({ ...lead, joinDate });
                return { ...lead, joinDate, expiryDate };
            });
            return res.json(leadsWithDates);
        }

        // File-storage fallback
        const data = readDb();
        const leads = Array.isArray(data.leads) ? data.leads.slice().reverse() : [];
        const leadsWithDates = leads.map((lead) => {
            const joinDate = lead.joinDate || lead.membership?.startDate || lead.convertedAt || lead.createdAt || null;
            const expiryDate = lead.expiryDate || deriveExpiryIso({ ...lead, joinDate });
            return { ...lead, joinDate, expiryDate };
        });
        return res.json(leadsWithDates);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('POST /leads called with body:', req.body);
        const {
            name,
            phone,
            email,
            source,
            interest,
            status,
            followUpDate,
            notes,
            membership,
            plan,
            planCode,
            startDate,
            pitchDate,
            leadSource,
            leadType
        } = req.body || {};

        if (!name || !phone) {
            return res.status(400).json({ error: 'name and phone are required' });
        }

        const now = new Date();
        const leadData = {
            name,
            phone,
            email: email || '',
            source: source || 'Unspecified',
            interest: interest || 'General Inquiry',
            status: status || 'New',
            followUpDate: followUpDate || null,
            notes: notes || '',
            pitchDate: pitchDate || null,
            leadSource: leadSource || null
        };
        if (leadType) leadData.leadType = leadType;

        // Persist provided membership / plan info if present and compute expiry
        if (membership || plan || planCode || startDate) {
            const storedMembership = membership || {};
            if (plan) storedMembership.plan = plan;
            if (planCode) storedMembership.planCode = planCode;
            if (startDate) storedMembership.startDate = startDate;
            leadData.membership = storedMembership;
            // compute expiry and persist it on the lead object
            const joinDate = storedMembership.startDate || now;
            const expiry = deriveExpiryIso({ ...leadData, membership: storedMembership, joinDate });
            if (expiry) leadData.expiryDate = expiry;
            // also surface joinDate explicitly
            leadData.joinDate = storedMembership.startDate || joinDate;
        }

        console.log('Lead data prepared:', leadData);

        // Normalize phone number for matching (last 10 digits)
        const normalizePhone = (value = '') => {
            const digits = String(value || '').replace(/\D/g, '');
            return digits.length >= 10 ? digits.slice(-10) : digits;
        };

        const normalizedPhone = normalizePhone(phone);

        // Prefer MongoDB if connected
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            // Check for existing lead with same phone number
            let existingLead = await LeadModel.findOne({ phone });
            if (!existingLead) {
                // Fallback: scan for normalized match
                const all = await LeadModel.find({});
                existingLead = all.find(l => normalizePhone(l.phone) === normalizedPhone);
            }

            if (existingLead) {
                // Update existing lead instead of creating duplicate
                Object.assign(existingLead, leadData);
                existingLead.updatedAt = now;
                await existingLead.save();
                console.log('Lead already exists, updated:', existingLead._id);
                return res.status(200).json({ data: existingLead, message: 'Lead already exists, updated successfully' });
            }

            // Create new lead if no duplicate found
            const created = await LeadModel.create({ ...leadData, createdAt: now, updatedAt: now });
            return res.status(201).json({ data: created });
        }

        // File-storage fallback
        const data = readDb();
        const leads = data.leads || [];

        // Check for existing lead with same phone number
        const existingIndex = leads.findIndex(l => {
            const leadNormalized = normalizePhone(l.phone);
            return leadNormalized === normalizedPhone || l.phone === phone;
        });

        if (existingIndex !== -1) {
            // Update existing lead instead of creating duplicate
            Object.assign(leads[existingIndex], leadData);
            leads[existingIndex].updatedAt = now;

            updateDb((current) => {
                current.leads = leads;
                return current;
            });

            console.log('Lead already exists, updated:', leads[existingIndex].id || leads[existingIndex].phone);
            return res.status(200).json({ data: leads[existingIndex], message: 'Lead already exists, updated successfully' });
        }

        const leadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newLead = {
            id: leadId,
            ...leadData,
            createdAt: now,
            updatedAt: now
        };

        updateDb((current) => {
            current.leads = current.leads || [];
            current.leads.push(newLead);
            return current;
        });

        return res.status(201).json({ data: newLead });
    } catch (error) {
        console.error('Error creating lead:', error.message);
        console.error('Error details:', error.stack);
        // Removed duplicate phone validation - allow creating memberships for all leads
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

router.put('/', async (req, res) => {
    try {
        const { phone, ...updateData } = req.body || {};

        if (!phone) {
            return res.status(400).json({ error: 'phone is required' });
        }

        // Normalize phone number for matching (last 10 digits)
        const normalizePhone = (value = '') => {
            const digits = String(value || '').replace(/\D/g, '');
            return digits.length >= 10 ? digits.slice(-10) : digits;
        };

        const normalizedPhone = normalizePhone(phone);

        // Prefer MongoDB if connected
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            let lead = await LeadModel.findOne({ phone });
            if (!lead) {
                // Fallback: scan for normalized match
                const all = await LeadModel.find({});
                const match = all.find(l => normalizePhone(l.phone) === normalizedPhone);
                if (!match) return res.status(404).json({ error: 'Lead not found' });
                lead = await LeadModel.findById(match._id);
            }

            Object.assign(lead, updateData);

            // Set convertedAt timestamp when status changes to Converted
            if (updateData.status && String(updateData.status).toLowerCase() === 'converted' && !lead.convertedAt) {
                lead.convertedAt = new Date();
            }

            // If membership data is provided, compute expiry
            if (updateData.membership || updateData.joinDate) {
                const joinDate = updateData.joinDate || lead.joinDate || lead.membership?.startDate || lead.createdAt || new Date();
                const expiry = deriveExpiryIso({ ...lead.toObject(), joinDate });
                if (expiry) lead.expiryDate = expiry;
                lead.joinDate = joinDate;
            }

            lead.updatedAt = new Date();
            await lead.save();
            console.log('Lead updated successfully (mongo):', lead._id);
            return res.json(lead);
        }

        // File-storage fallback
        const data = readDb();
        const leads = data.leads || [];

        // Find lead by matching normalized phone numbers
        const leadIndex = leads.findIndex(l => {
            const leadNormalized = normalizePhone(l.phone);
            return leadNormalized === normalizedPhone || l.phone === phone;
        });

        if (leadIndex === -1) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Update the lead
        Object.assign(leads[leadIndex], updateData);

        // Set convertedAt timestamp when status changes to Converted
        if (updateData.status && String(updateData.status).toLowerCase() === 'converted' && !leads[leadIndex].convertedAt) {
            leads[leadIndex].convertedAt = new Date();
        }

        // If membership data is provided, compute expiry
        if (updateData.membership || updateData.joinDate) {
            const joinDate = updateData.joinDate || leads[leadIndex].joinDate || leads[leadIndex].membership?.startDate || leads[leadIndex].createdAt || new Date();
            const expiry = deriveExpiryIso({ ...leads[leadIndex], joinDate });
            if (expiry) leads[leadIndex].expiryDate = expiry;
            leads[leadIndex].joinDate = joinDate;
        }

        leads[leadIndex].updatedAt = new Date();

        updateDb((current) => {
            current.leads = leads;
            return current;
        });

        console.log('Lead updated successfully (file):', leads[leadIndex].id || leads[leadIndex].phone);
        return res.json(leads[leadIndex]);
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

module.exports = router;
