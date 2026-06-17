const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const otpCache = new Map();

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const createOtpForPhone = (phone) => {
    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    otpCache.set(phone, { otp, expiresAt, attempts: 0 });
    return { otp, expiresAt };
};

const verifyOtpForPhone = (phone, submittedOtp) => {
    const entry = otpCache.get(phone);
    if (!entry) {
        return { success: false, reason: 'OTP not found' };
    }

    if (Date.now() > entry.expiresAt) {
        otpCache.delete(phone);
        return { success: false, reason: 'OTP expired' };
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
        otpCache.delete(phone);
        return { success: false, reason: 'Too many attempts' };
    }

    if (entry.otp !== String(submittedOtp)) {
        return { success: false, reason: 'Invalid OTP' };
    }

    otpCache.delete(phone);
    return { success: true };
};

module.exports = {
    createOtpForPhone,
    verifyOtpForPhone
};
