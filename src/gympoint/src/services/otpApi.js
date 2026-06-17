// OTP API client for frontend
const API_BASE = process.env.REACT_APP_GYM_API_URL ? process.env.REACT_APP_GYM_API_URL + '/api/auth' : '/api/auth';

export async function sendOtp(phone) {
    const res = await fetch(`${API_BASE}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
    // Show alert on success
    if (data.message && typeof window !== 'undefined') {
        window.alert('OTP sent successfully!');
    }
    return data;
}

export async function verifyOtp(phone, otp) {
    const res = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');
    return data;
}
