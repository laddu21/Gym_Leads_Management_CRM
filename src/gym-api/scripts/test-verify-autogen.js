// Test script to verify an AUTOGEN OTP via 2Factor
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { verifyAutogenOtp } = require('../src/services/sms');

(async () => {
    const session = process.argv[2];
    const otp = process.argv[3];
    if (!session || !otp) {
        console.error('Usage: node scripts/test-verify-autogen.js <sessionId> <otp>');
        process.exit(1);
    }
    const result = await verifyAutogenOtp(session, otp);
    console.log('Verify result:', JSON.stringify(result, null, 2));
})();
