
const axios = require('axios');
const twilio = require('twilio');

const {
    TWOFACTOR_API_KEY,
    TWOFACTOR_TEMPLATE_ID,
    TWOFACTOR_CUSTOM_MESSAGE
} = process.env;

// Helper to send OTP using 2Factor.in
async function sendOtpSms(to, otp) {
    if (!TWOFACTOR_API_KEY) {
        return {
            delivered: false,
            reason: '2Factor.in API key missing.'
        };
    }

    // Normalize phone numbers: keep last 10 digits as local number
    const raw = String(to || '').trim();
    let digits = raw.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(-10);
    if (digits.length !== 10) {
        return { delivered: false, reason: 'Invalid phone number' };
    }
    const localNumber = digits; // 10-digit
    const e164NoPlus = '91' + localNumber; // 91XXXXXXXXXX
    const e164 = '+' + e164NoPlus; // +91XXXXXXXXXX

    // If template ID configured, use template endpoint
    if (TWOFACTOR_TEMPLATE_ID) {
        const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${e164NoPlus}/${otp}/${TWOFACTOR_TEMPLATE_ID}`;
        if (process.env.SMS_DRY_RUN === 'true') {
            return {
                delivered: false,
                dryRun: true,
                endpoint: url.replace(TWOFACTOR_API_KEY, 'REDACTED'),
                payload: { phone: e164NoPlus, otp, templateId: TWOFACTOR_TEMPLATE_ID }
            };
        }
        try {
            const response = await axios.get(url);
            const data = response.data;
            if (data && data.Status === 'Success') {
                return { delivered: true, details: data };
            }
            return { delivered: false, reason: (data && data.Details) || 'Failed to send OTP via template' };
        } catch (error) {
            return { delivered: false, reason: error.message };
        }
    }

    // If custom message configured, use TSMS addon endpoint
    if (TWOFACTOR_CUSTOM_MESSAGE) {
        const message = TWOFACTOR_CUSTOM_MESSAGE.replace(/{{\s*otp\s*}}/gi, otp);
        const endpoint = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/ADDON_SERVICES/SEND/TSMS`;
        const params = {
            To: e164, // +91XXXXXXXXXX
            Message: message,
            From: process.env.TWOFACTOR_SENDER_ID || null
        };
        // Allow dry-run previews even if From is not configured
        if (process.env.SMS_DRY_RUN === 'true') {
            return {
                delivered: false,
                dryRun: true,
                endpoint: endpoint.replace(TWOFACTOR_API_KEY, 'REDACTED'),
                params: { ...params, Message: params.Message.slice(0, 120) }
            };
        }
        // The TSMS addon requires a registered sender ID (From) when actually
        // sending. If it's not configured we cannot reliably send a custom SMS.
        if (!process.env.TWOFACTOR_SENDER_ID) {
            return {
                delivered: false,
                reason: 'TWOFACTOR_SENDER_ID is not configured. To send custom SMS via ADDON_SERVICES you must set TWOFACTOR_SENDER_ID to your approved sender id, or configure TWOFACTOR_TEMPLATE_ID to use template-based OTP.'
            };
        }
        if (process.env.DEBUG_SMS === 'true') {
            // eslint-disable-next-line no-console
            console.debug('2Factor TSMS request', { endpoint, params: { ...params, Message: params.Message.slice(0, 60) + (params.Message.length > 60 ? '...' : '') } });
        }
        // Try GET with +91 first
        try {
            if (process.env.DEBUG_SMS === 'true') {
                // eslint-disable-next-line no-console
                console.debug('Attempting TSMS GET with params', params);
            }
            const response = await axios.get(endpoint, { params });
            const data = response.data;
            if (data && (data.Status === 'Success' || data.status === 'Success')) {
                return { delivered: true, details: data };
            }
            // If the service reports missing 'To' parameter, try alternate formats
            const bodyStr = typeof data === 'string' ? data : JSON.stringify(data || {});
            if (/Missing\s+'?To'?\s+parameter/i.test(bodyStr) || /Missing\s+To/i.test(bodyStr)) {
                // Try GET without + (use 91XXXXXXXXXX)
                const paramsNoPlus = { ...params, To: e164NoPlus };
                if (process.env.DEBUG_SMS === 'true') {
                    // eslint-disable-next-line no-console
                    console.debug('Retrying TSMS GET without plus with params', paramsNoPlus);
                }
                const r2 = await axios.get(endpoint, { params: paramsNoPlus });
                const d2 = r2.data;
                if (d2 && (d2.Status === 'Success' || d2.status === 'Success')) {
                    return { delivered: true, details: d2 };
                }
                // Finally try POST (form encoded)
                const qs = new URLSearchParams({ To: e164NoPlus, Message: message });
                if (process.env.TWOFACTOR_SENDER_ID) qs.append('From', process.env.TWOFACTOR_SENDER_ID);
                if (process.env.DEBUG_SMS === 'true') {
                    // eslint-disable-next-line no-console
                    console.debug('Retrying TSMS POST form with body', qs.toString().slice(0, 200));
                }
                const r3 = await axios.post(endpoint, qs.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                const d3 = r3.data;
                if (d3 && (d3.Status === 'Success' || d3.status === 'Success')) {
                    return { delivered: true, details: d3 };
                }
                return { delivered: false, reason: (d3 && (d3.Details || d3.details)) || (d2 && (d2.Details || d2.details)) || (data && (data.Details || data.details)) || 'Failed to send custom OTP message' };
            }
            return { delivered: false, reason: (data && (data.Details || data.details)) || 'Failed to send custom OTP message' };
        } catch (error) {
            // If error contains missing 'To' string in response body, attempt fallback
            const errMsg = error && error.response && error.response.data ? String(error.response.data) : error.message;
            if (/Missing\s+'?To'?\s+parameter/i.test(errMsg) || /Missing\s+To/i.test(errMsg)) {
                try {
                    const paramsNoPlus = { ...params, To: e164NoPlus };
                    if (process.env.DEBUG_SMS === 'true') {
                        // eslint-disable-next-line no-console
                        console.debug('Error path: retrying TSMS GET without plus with params', paramsNoPlus);
                    }
                    const r2 = await axios.get(endpoint, { params: paramsNoPlus });
                    const d2 = r2.data;
                    if (d2 && (d2.Status === 'Success' || d2.status === 'Success')) {
                        return { delivered: true, details: d2 };
                    }
                    const qs = new URLSearchParams({ To: e164NoPlus, Message: message });
                    if (process.env.TWOFACTOR_SENDER_ID) qs.append('From', process.env.TWOFACTOR_SENDER_ID);
                    if (process.env.DEBUG_SMS === 'true') {
                        // eslint-disable-next-line no-console
                        console.debug('Error path: retrying TSMS POST form with body', qs.toString().slice(0, 200));
                    }
                    const r3 = await axios.post(endpoint, qs.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                    const d3 = r3.data;
                    if (d3 && (d3.Status === 'Success' || d3.status === 'Success')) {
                        return { delivered: true, details: d3 };
                    }
                    return { delivered: false, reason: (d3 && (d3.Details || d3.details)) || (d2 && (d2.Details || d2.details)) || errMsg };
                } catch (err2) {
                    return { delivered: false, reason: err2.message || 'Failed to send OTP (fallback attempts failed)' };
                }
            }
            return { delivered: false, reason: error.message };
        }
    }

    return {
        delivered: false,
        reason: 'Neither TWOFACTOR_TEMPLATE_ID nor TWOFACTOR_CUSTOM_MESSAGE is configured.'
    };
}

// Normalize Indian phone numbers and produce variants used by 2Factor
function normalizeIndianPhone(input) {
    const raw = String(input || '').trim();
    let digits = raw.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(-10);
    if (digits.length !== 10) return null;
    const localNumber = digits; // 10-digit
    const e164NoPlus = '91' + localNumber; // 91XXXXXXXXXX
    const e164 = '+' + e164NoPlus; // +91XXXXXXXXXX
    return { localNumber, e164NoPlus, e164 };
}

// Use 2Factor AUTOGEN endpoints to ask 2Factor to generate and deliver an OTP.
// This does not require a template or sender id on the client — 2Factor handles
// generation and delivery. Different variants of the endpoint are tried until
// one responds with Success.
async function sendOtpAutogen(to, opts = {}) {
    // Require +91-prefixed number
    const raw = String(to || '').trim();
    const cleaned = raw.replace(/\s|-/g, '');
    if (!/^\+91\d{10}$/.test(cleaned)) {
        return { delivered: false, reason: 'Phone number must include +91 and 10 digits, e.g. +919876543210' };
    }
    const digits = cleaned.replace(/\D/g, ''); // '91XXXXXXXXXX'
    const e164NoPlus = digits;
    const e164 = '+' + digits;

    // Try explicit SMS-first variants
    const suffixes = ['AUTOGEN', 'AUTOGEN/OTP', 'AUTOGEN/4', 'AUTOGEN/6', 'AUTOGEN/'];
    const channelParamNames = ['channel', 'Channel', 'via', 'method', 'type', 'mode'];

    if (process.env.SMS_DRY_RUN === 'true') {
        const previewUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${e164NoPlus}/AUTOGEN`;
        return { delivered: false, dryRun: true, endpoint: previewUrl.replace(TWOFACTOR_API_KEY, 'REDACTED'), params: { To: e164, forceChannel: 'sms' } };
    }

    let lastError = null;
    for (const suffix of suffixes) {
        const baseUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${e164NoPlus}/${suffix}`;

        // 1) Try explicit /SMS suffix first
        try {
            const urlSmsSuffix = baseUrl.endsWith('/') ? baseUrl + 'SMS' : baseUrl + '/SMS';
            if (process.env.DEBUG_SMS === 'true') {
                // eslint-disable-next-line no-console
                console.debug('Trying AUTOGEN endpoint with /SMS suffix', urlSmsSuffix);
            }
            const r = await axios.get(urlSmsSuffix);
            const d = r && r.data ? r.data : null;
            if (d && (d.Status === 'Success' || d.status === 'Success')) {
                const sid = typeof d.Details === 'string' ? d.Details : (d.Details || d.details || null);
                return { delivered: true, sessionId: sid, details: d };
            }
            lastError = d || lastError;
        } catch (err) {
            lastError = err && err.response && err.response.data ? err.response.data : err.message || String(err);
            if (process.env.DEBUG_SMS === 'true') {
                // eslint-disable-next-line no-console
                console.debug('AUTOGEN /SMS suffix attempt failed', { url: baseUrl + '/SMS', error: lastError });
            }
        }

        // 2) Try query params to force channel=sms
        for (const paramName of channelParamNames) {
            try {
                const params = { [paramName]: 'sms' };
                if (process.env.DEBUG_SMS === 'true') {
                    // eslint-disable-next-line no-console
                    console.debug('Trying AUTOGEN endpoint with channel param', { url: baseUrl, params });
                }
                const r2 = await axios.get(baseUrl, { params });
                const d2 = r2 && r2.data ? r2.data : null;
                if (d2 && (d2.Status === 'Success' || d2.status === 'Success')) {
                    const sid = typeof d2.Details === 'string' ? d2.Details : (d2.Details || d2.details || null);
                    return { delivered: true, sessionId: sid, details: d2 };
                }
                lastError = d2 || lastError;
            } catch (innerErr) {
                lastError = innerErr && innerErr.response && innerErr.response.data ? innerErr.response.data : innerErr.message || String(innerErr);
                if (process.env.DEBUG_SMS === 'true') {
                    // eslint-disable-next-line no-console
                    console.debug('AUTOGEN channel param attempt failed', { url: baseUrl, paramName, error: lastError });
                }
            }
        }

        // 3) Finally try plain GET as fallback
        try {
            if (process.env.DEBUG_SMS === 'true') {
                // eslint-disable-next-line no-console
                console.debug('Trying AUTOGEN endpoint plain GET', baseUrl);
            }
            const r3 = await axios.get(baseUrl);
            const d3 = r3 && r3.data ? r3.data : null;
            if (d3 && (d3.Status === 'Success' || d3.status === 'Success')) {
                const sid = typeof d3.Details === 'string' ? d3.Details : (d3.Details || d3.details || null);
                return { delivered: true, sessionId: sid, details: d3 };
            }
            lastError = d3 || lastError;
        } catch (err3) {
            lastError = err3 && err3.response && err3.response.data ? err3.response.data : err3.message || String(err3);
            if (process.env.DEBUG_SMS === 'true') {
                // eslint-disable-next-line no-console
                console.debug('AUTOGEN plain GET attempt failed', { url: baseUrl, error: lastError });
            }
        }
    }

    return { delivered: false, reason: 'AUTOGEN attempts (SMS-first) failed', details: lastError };
}

// Verify an OTP that was generated via AUTOGEN. The sessionId is typically
// returned in the `Details` field from the AUTOGEN call.
async function verifyAutogenOtp(sessionId, otp) {
    if (!sessionId || !otp) return { verified: false, reason: 'sessionId and otp are required' };
    if (!TWOFACTOR_API_KEY) return { verified: false, reason: '2Factor API key missing' };
    const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
    try {
        const res = await axios.get(url);
        const data = res && res.data ? res.data : null;
        if (data && (data.Status === 'Success' || data.status === 'Success')) {
            return { verified: true, details: data };
        }
        return { verified: false, reason: (data && (data.Details || data.details)) || 'Verification failed', details: data };
    } catch (err) {
        const reason = err && err.response && err.response.data ? err.response.data : err.message || String(err);
        return { verified: false, reason };
    }
}

/**
 * Verify an AUTOGEN OTP and return a boolean result.
 * @param {string} sessionId - session id returned by sendOtpAutogen
 * @param {string} otp - user-entered OTP
 * @returns {Promise<boolean>} true when OTP verified, false otherwise
 */
async function verifyOtpAutogenBoolean(sessionId, otp) {
    try {
        if (!sessionId || !otp) {
            if (process.env.DEBUG_SMS === 'true') console.error('verifyOtpAutogenBoolean: missing sessionId or otp');
            return false;
        }
        if (!TWOFACTOR_API_KEY) {
            if (process.env.DEBUG_SMS === 'true') console.error('verifyOtpAutogenBoolean: missing TWOFACTOR_API_KEY');
            return false;
        }
        const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
        const res = await axios.get(url, { timeout: 8000 });
        const data = res && res.data ? res.data : null;
        if (data && (data.Status === 'Success' || data.status === 'Success')) {
            return true;
        }
        if (process.env.DEBUG_SMS === 'true') {
            // eslint-disable-next-line no-console
            console.debug('verifyOtpAutogenBoolean: verification response', data);
        }
        return false;
    } catch (err) {
        if (process.env.DEBUG_SMS === 'true') {
            // eslint-disable-next-line no-console
            console.error('verifyOtpAutogenBoolean: error verifying OTP', err && err.response ? err.response.data : err.message || err);
        }
        return false;
    }
}

// Send an SMS using Twilio. Returns a delivery result object.
async function sendSmsViaTwilio(to, message) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
    // Normalize phone
    let phone = String(to || '').trim();
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.startsWith('+')) digits = digits.replace(/^\+/, '');
    const phoneE164 = digits.startsWith('91') ? '+' + digits.replace(/^\+/, '') : phone;

    // Support dry-run preview so you can inspect message without credentials
    if (process.env.SMS_DRY_RUN === 'true') {
        return {
            delivered: false,
            dryRun: true,
            provider: 'twilio',
            preview: {
                to: phoneE164,
                from: TWILIO_FROM || null,
                body: String(message).slice(0, 240)
            }
        };
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
        return { delivered: false, reason: 'Missing Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)' };
    }
    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const msg = await client.messages.create({ body: message, from: TWILIO_FROM, to: phoneE164 });
        return { delivered: true, sid: msg.sid, details: msg };
    } catch (err) {
        return { delivered: false, reason: err && err.message ? err.message : String(err) };
    }
}

module.exports = {
    sendOtpSms,
    sendOtpAutogen,
    verifyAutogenOtp,
    verifyOtpAutogenBoolean,
    sendSmsViaTwilio
};
