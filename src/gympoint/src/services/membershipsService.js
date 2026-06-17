import apiClient from './apiClient';

const BASE_PATH = '/memberships';

export const membershipsService = {
    list: async (category) => {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        const response = await apiClient.get(`${BASE_PATH}${params}`);
        console.log('Memberships API response:', response);
        // The API returns the array directly, not wrapped in data
        return response.data || response;
    },
    history: async (limit = 50) => {
        // Returns recent membership change history
        const response = await apiClient.get(`${BASE_PATH}/history?limit=${encodeURIComponent(limit)}`);
        return response.data || response;
    },
    historyByPhone: async (phone, limit = 500) => {
        const params = new URLSearchParams({ phone: String(phone || ''), limit: String(limit) });
        const response = await apiClient.get(`${BASE_PATH}/history/by-phone?${params.toString()}`);
        return response.data || response;
    },
    create: (payload) => apiClient.post(BASE_PATH, payload).then((res) => res.data),
};
