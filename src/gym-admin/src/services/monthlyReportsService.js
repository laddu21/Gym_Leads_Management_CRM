
import { monthlyReportsApi } from './apiClient';

export const monthlyReportsService = {
    getTrialAttended: (year, month, page = 1, limit = 10) => {
        // This endpoint may need to be added to apiClient.js if not present
        // For now, use monthlyReportsApi.archive or getNewMembers as a template
        // Placeholder: implement as needed
        throw new Error('getTrialAttended not implemented in monthlyReportsApi');
    },
    getNewMembers: (year, month, page = 1, limit = 10) => {
        return monthlyReportsApi.getNewMembers(year, month, page, limit);
    },
    getSummary: (yearsBack = 10) => {
        // This endpoint may need to be added to apiClient.js if not present
        // Placeholder: implement as needed
        throw new Error('getSummary not implemented in monthlyReportsApi');
    }
};
