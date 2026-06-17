// Test script to invoke sendOtpSms
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sendOtpSms } = require('../src/services/sms');

(async () => {
    const argPhone = process.argv[2] || '9876543210';
    const otp = process.argv[3] || Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Testing sendOtpSms with phone:', argPhone, 'otp:', otp);
    const result = await sendOtpSms(argPhone, otp);
    console.log('Result:', JSON.stringify(result, null, 2));
})();
