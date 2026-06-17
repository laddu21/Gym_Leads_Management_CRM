import apiClient from '../apiClient';

export const trainersService = {
    async list() {
        return apiClient.get('/trainers');
    },
    async create(payload) {
        return apiClient.post('/trainers', payload);
    },
    async update(id, payload) {
        return apiClient.patch(`/trainers/${id}`, payload);
    },
    async remove(id) {
        return apiClient.delete(`/trainers/${id}`);
    }
};
