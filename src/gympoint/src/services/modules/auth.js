import apiClient from '../apiClient';

const DEFAULT_TIMEOUT_MS = 10_000;

const withTimeout = async (promiseFactory, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await promiseFactory(controller.signal);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('OTP request timed out. Please try again.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export const authService = {
    async requestOtp(phone, timeoutMs = DEFAULT_TIMEOUT_MS) {
        return withTimeout((signal) => apiClient.post('/auth/request-otp', { phone }, { signal }), timeoutMs);
    },
    async verifyOtp(phone, otp) {
        return apiClient.post('/auth/verify-otp', { phone, otp });
    }
};
