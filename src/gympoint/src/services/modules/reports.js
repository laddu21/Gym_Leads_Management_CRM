import apiClient from '../apiClient';

export const reportsService = {
    async getSummary() {
        return apiClient.get('/reports');
    },
    async listPitches(date) {
        const params = date ? `?date=${encodeURIComponent(date)}` : '';
        return apiClient.get(`/pitches${params}`);
    },
    async createPitch(payload, token) {
        const options = token
            ? {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            }
            : undefined;
        return apiClient.post('/pitches', payload, options);
    }
};
