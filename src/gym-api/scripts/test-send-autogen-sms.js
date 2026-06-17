// Test script to request an AUTOGEN OTP forcing SMS channel
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sendOtpAutogen } = require('../src/services/sms');

(async () => {
    const argPhone = process.argv[2] || '9876543210';
    console.log('Requesting AUTOGEN OTP (force SMS) to:', argPhone);
    const result = await sendOtpAutogen(argPhone, { channel: 'sms' });
    console.log('Result:', JSON.stringify(result, null, 2));
})();
