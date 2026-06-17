const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createOtpForPhone, verifyOtpForPhone } = require('../auth/otpStore');
const { sendOtpSms, sendOtpAutogen, verifyAutogenOtp, sendSmsViaTwilio } = require('../services/sms');
const { JWT_SECRET } = require('../middleware/auth');
const { readDb, updateDb } = require('../storage');
const Gym = require('../models/Gym');
const Membership = require('../models/Membership');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const AttendanceHistory = require('../models/AttendanceHistory');
const AttendanceRecord = require('../models/AttendanceRecord');
const MembershipHistory = require('../models/MembershipHistory');
const MonthlyRegistration = require('../models/MonthlyRegistration');
const MonthlyTrialAttended = require('../models/MonthlyTrialAttended');
const UserMembership = require('../models/UserMembership');
const router = express.Router();

const sanitizePhone = (phone) => phone.replace(/[^+\d]/g, '');

// Endpoint to check if any gym exists (for registration gating)
router.get('/gyms-exist', async (req, res) => {
    try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const gyms = await Gym.find({}, 'gymName').limit(1);
            if (gyms.length > 0) {
                return res.json({ exists: true, gymName: gyms[0].gymName });
            }
            return res.json({ exists: false });
        }

        const data = readDb();
        const gyms = Array.isArray(data.gyms) ? data.gyms : [];
        if (gyms.length > 0) {
            return res.json({ exists: true, gymName: gyms[0].gymName });
        }
        return res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check gyms', details: err.message });
    }
});

// Register a new gym
router.post('/register-gym', async (req, res) => {
    try {
        const { gymName, email, password } = req.body || {};
        if (!gymName || !email || !password) {
            return res.status(400).json({ error: 'gymName, email, and password are required' });
        }

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const existing = await Gym.findOne({ email });
            if (existing) {
                return res.status(409).json({ error: 'Email already registered' });
            }
            const gym = await Gym.create({ gymName, email, password });
            return res.status(201).json({ gymName: gym.gymName, email: gym.email });
        }

        const data = readDb();
        const gyms = Array.isArray(data.gyms) ? data.gyms : [];
        const existing = gyms.find((gym) => gym.email === email);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        updateDb((current) => {
            current.gyms = Array.isArray(current.gyms) ? current.gyms : [];
            current.gyms.push({ gymName, email, password });
            return current;
        });

        return res.status(201).json({ gymName, email });
    } catch (err) {
        return res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

// Login for gym
router.post('/login-gym', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const gym = await Gym.findOne({ email });
            if (!gym || gym.password !== password) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            return res.json({ gymName: gym.gymName, email: gym.email });
        }

        const data = readDb();
        const gyms = Array.isArray(data.gyms) ? data.gyms : [];
        const gym = gyms.find((item) => item.email === email);
        if (!gym || gym.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        return res.json({ gymName: gym.gymName, email: gym.email });
    } catch (err) {
        return res.status(500).json({ error: 'Login failed', details: err.message });
    }
});

// Clear month data (memberships, attendance, but keep performance and leads history)
router.post('/clear-month-data', async (req, res) => {
    try {
        await Membership.deleteMany({});
        await AttendanceHistory.deleteMany({});
        await AttendanceRecord.deleteMany({});
        await MembershipHistory.deleteMany({});
        await MonthlyRegistration.deleteMany({});
        await MonthlyTrialAttended.deleteMany({});
        await UserMembership.deleteMany({});
        res.json({ message: 'Month data cleared successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear month data', details: err.message });
    }
});

router.post('/request-otp', async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) {
        return res.status(400).json({ error: 'phone is required' });
    }

    const normalizedPhone = sanitizePhone(String(phone));
    if (!normalizedPhone) {
        return res.status(400).json({ error: 'phone is invalid' });
    }

    // If there's no template ID and no sender ID configured use 2Factor AUTOGEN
    // to request an OTP via SMS (server will return a sessionId to the client).
    const useAutogen = !process.env.TWOFACTOR_TEMPLATE_ID && !process.env.TWOFACTOR_SENDER_ID;

    if (useAutogen) {
        // Require client to pass phone with +91 prefix to avoid accidental call delivery
        if (!normalizedPhone.startsWith('+91')) {
            return res.status(400).json({ error: 'phone must include +91 country code (e.g. +919876543210)' });
        }

        const deliveryResult = await sendOtpAutogen(normalizedPhone, { channel: 'sms' });
        console.info(`AUTOGEN OTP request for ${normalizedPhone}:`, deliveryResult);
        if (deliveryResult.delivered) {
            return res.json({
                message: 'OTP requested via 2Factor AUTOGEN',
                delivered: true,
                sessionId: deliveryResult.sessionId,
                details: deliveryResult.details
            });
        }

        // If AUTOGEN failed to deliver via SMS, try Twilio fallback (send OTP directly)
        // Generate a local OTP and store it so we can verify it later via server-side store.
        const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
            const { otp, expiresAt } = createOtpForPhone(normalizedPhone);
            const tpl = process.env.TWOFACTOR_CUSTOM_MESSAGE || '{{otp}} is Your One Time Verification Code to verify your Phone Number, expiry in 10 mins.. ';
            const message = tpl.replace(/{{\s*otp\s*}}/gi, otp);
            const twilioResult = await sendSmsViaTwilio(normalizedPhone, message);
            console.info('Twilio fallback attempt (OTP send):', twilioResult);
            if (twilioResult.delivered) {
                return res.json({
                    message: 'OTP sent via Twilio fallback',
                    delivered: true,
                    expiresAt
                });
            }
            if (twilioResult.dryRun) {
                // Return preview for dry-run mode
                return res.json({ message: 'Twilio dry-run (preview only)', delivered: false, dryRun: true, preview: twilioResult.preview });
            }
            return res.status(500).json({ error: 'Failed to send OTP via Twilio', reason: twilioResult.reason });
        }

        return res.status(500).json({ error: 'Failed to request OTP via 2Factor and no Twilio fallback configured', reason: deliveryResult.reason || deliveryResult.details, advice: 'Set TWOFACTOR_TEMPLATE_ID or TWOFACTOR_SENDER_ID for 2Factor SMS, or configure Twilio (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM) for direct SMS fallback.' });
    }

    // Fallback/local flow: create OTP and deliver using configured SMS/template
    const { otp, expiresAt } = createOtpForPhone(normalizedPhone);
    const deliveryResult = await sendOtpSms(normalizedPhone, otp);
    // Only log OTP for debugging, do not send to frontend
    console.info(`OTP for ${normalizedPhone}: ${otp}`);
    return res.json({
        message: 'OTP sent successfully',
        expiresAt,
        delivered: deliveryResult.delivered,
        ...(deliveryResult.sid ? { sid: deliveryResult.sid } : {}),
        ...(deliveryResult.reason ? { deliveryNote: deliveryResult.reason } : {})
    });
});

router.post('/verify-otp', async (req, res) => {
    const { phone, otp, sessionId } = req.body || {};
    // If sessionId is provided, verify using 2Factor AUTOGEN verify endpoint
    if (sessionId) {
        if (!otp) return res.status(400).json({ error: 'otp is required when verifying by sessionId' });
        const verification = await verifyAutogenOtp(String(sessionId), String(otp));
        if (!verification.verified) {
            return res.status(400).json({ error: verification.reason || 'Invalid OTP' });
        }
        // If phone present, issue JWT for that phone (keeps previous behavior)
        if (phone) {
            const normalizedPhone = sanitizePhone(String(phone));
            // Assign default role or use provided
            const role = req.body.role || 'member';
            const token = jwt.sign({ phone: normalizedPhone, role }, JWT_SECRET, { expiresIn: '2h' });
            return res.json({ message: 'OTP verified', token, details: verification.details });
        }
        return res.json({ message: 'OTP verified', details: verification.details });
    }

    // Legacy/local verification by phone+otp
    if (!phone || !otp) {
        return res.status(400).json({ error: 'phone and otp are required' });
    }
    const normalizedPhone = sanitizePhone(String(phone));
    const verification = verifyOtpForPhone(normalizedPhone, String(otp));
    if (!verification.success) {
        return res.status(400).json({ error: verification.reason || 'Invalid OTP' });
    }
    // Assign default role or use provided
    const role = req.body.role || 'member';
    const token = jwt.sign({ phone: normalizedPhone, role }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({ message: 'OTP verified', token });
});

module.exports = router;
