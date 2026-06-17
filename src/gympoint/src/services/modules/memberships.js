import apiClient from '../apiClient';

export const membershipsService = {
    async create(payload) {
        return apiClient.post('/memberships', payload);
    },
    async list(category) {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        return apiClient.get(`/memberships${params}`);
    },
    async update(id, payload) {
        return apiClient.patch(`/memberships/${id}`, payload);
    }
};
