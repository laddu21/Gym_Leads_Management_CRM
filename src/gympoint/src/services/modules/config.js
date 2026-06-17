import apiClient from '../apiClient';

export const configService = {
    async getBenefits(category = 'premium') {
        const res = await apiClient.get(`/config/benefits?category=${encodeURIComponent(category)}`);
        return Array.isArray(res?.items) ? res.items : [];
    }
};
