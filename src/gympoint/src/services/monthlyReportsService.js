import apiClient from './apiClient';

/**
 * Service for fetching monthly historical reports data
 */

export const monthlyReportsService = {
    /**
     * Get trial attended leads for a specific month
     * @param {number} year - Year (e.g., 2025)
     * @param {number} month - Month (1-12)
     * @param {number} page - Page number (default: 1)
     * @param {number} limit - Items per page (default: 10)
     */
    async getTrialAttended(year, month, page = 1, limit = 10) {
        try {
            const params = new URLSearchParams({
                year: year.toString(),
                month: month.toString(),
                page: page.toString(),
                limit: limit.toString()
            });

            const response = await apiClient.get(`/monthly-reports/trial-attended?${params}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching trial attended leads:', error);
            throw error;
        }
    },

    /**
     * Get new members (converted leads) for a specific month
     * @param {number} year - Year (e.g., 2025)
     * @param {number} month - Month (1-12)
     * @param {number} page - Page number (default: 1)
     * @param {number} limit - Items per page (default: 10)
     */
    async getNewMembers(year, month, page = 1, limit = 10) {
        try {
            const params = new URLSearchParams({
                year: year.toString(),
                month: month.toString(),
                page: page.toString(),
                limit: limit.toString()
            });

            const response = await apiClient.get(`/monthly-reports/new-members?${params}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching new members:', error);
            throw error;
        }
    },

    /**
     * Get summary of all months with data
     * @param {number} yearsBack - Number of years to look back (default: 10)
     */
    async getSummary(yearsBack = 10) {
        try {
            const params = new URLSearchParams({
                yearsBack: yearsBack.toString()
            });

            const response = await apiClient.get(`/monthly-reports/summary?${params}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching monthly summary:', error);
            throw error;
        }
    }
};
