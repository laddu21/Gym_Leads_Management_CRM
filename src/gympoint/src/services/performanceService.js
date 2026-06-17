import apiClient from './apiClient';

const BASE_PATH = '/performance';

export const performanceService = {
    // Get monthly performance data (current month by default)
    getMonthlyPerformance: (year, month) => {
        const params = {};
        if (year) params.year = year;
        if (month) params.month = month;
        return apiClient.get(BASE_PATH, { params }).then((res) => res.data || res);
    },

    // Set monthly target
    setTarget: (target, year, month) => {
        return apiClient.post(`${BASE_PATH}/target`, { target, year, month }).then((res) => res.data || res);
    }
};
