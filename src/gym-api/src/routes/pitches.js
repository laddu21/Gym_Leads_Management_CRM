const express = require('express');
const { v4: uuid } = require('uuid');
const { readDb, updateDb } = require('../storage');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();


// Enhanced: Merge daily leads with pitchDate into the pitches list for admin/dash
router.get('/', (req, res) => {
    const { date } = req.query;
    const data = readDb();
    let pitches = data.pitches || [];
    let leads = data.leads || [];

    // Filter leads that have a pitchDate (and match the date if provided)
    let leadsWithPitch = leads.filter(l => l.pitchDate && (!date || l.pitchDate === date));
    // Normalize leads to pitch-like objects
    leadsWithPitch = leadsWithPitch.map(l => ({
        id: l.id || l._id,
        name: l.name,
        phone: l.phone,
        email: l.email || '',
        leadSource: l.leadSource || l.source || '',
        plan: l.plan || '',
        interest: l.interest || '',
        remarks: l.notes || '',
        pitchDate: l.pitchDate,
        recordedAt: l.trialAttendedAt || l.updatedAt || l.createdAt || '',
        fromLead: true
    }));

    // Filter pitches by date if provided
    let filteredPitches = pitches;
    if (date) {
        filteredPitches = pitches.filter((pitch) => pitch.pitchDate === date);
    }

    // Merge and sort by recordedAt desc
    const allPitches = [...filteredPitches, ...leadsWithPitch].sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));
    res.json(allPitches);
});

router.post('/', authenticateRequest, (req, res) => {
    const { name, phone, email, leadSource, plan, interest, remarks, pitchDate } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ error: 'name and phone are required' });
    }

    const now = new Date();
    const record = {
        id: uuid(),
        name,
        phone,
        email: email || '',
        leadSource: leadSource || '',
        plan: plan || '',
        interest: interest || '',
        remarks: remarks || '',
        pitchDate: pitchDate || now.toISOString().slice(0, 10),
        recordedAt: now.toISOString()
    };

    updateDb((data) => ({
        ...data,
        pitches: [record, ...(data.pitches || [])]
    }));

    res.status(201).json({ data: record });
});

module.exports = router;
