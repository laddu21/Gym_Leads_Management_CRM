import apiClient from './apiClient';

export const attendanceService = {
    async listRecords() {
        try {
            const response = await apiClient.get('/attendance/records');
            return Array.isArray(response) ? response : [];
        } catch (error) {
            console.error('Failed to fetch attendance records:', error);
            return [];
        }
    },

    async createRecord(record) {
        try {
            const response = await apiClient.post('/attendance/records', record);
            return response;
        } catch (error) {
            console.error('Failed to create attendance record:', error);
            throw error;
        }
    },

    async removeRecord(recordKey) {
        try {
            // Use DELETE endpoint with membershipId or phone query parameter
            const response = await apiClient.delete(`/attendance/records?membershipId=${encodeURIComponent(recordKey)}`);
            return response;
        } catch (error) {
            // Try with phone if membershipId fails
            try {
                const response = await apiClient.delete(`/attendance/records?phone=${encodeURIComponent(recordKey)}`);
                return response;
            } catch (err) {
                console.error('Failed to remove attendance record:', error);
                throw error;
            }
        }
    },

    async listHistory() {
        try {
            const response = await apiClient.get('/attendance/history');
            return response || {};
        } catch (error) {
            console.error('Failed to fetch attendance history:', error);
            return {};
        }
    },

    async saveHistory(history) {
        try {
            // Note: This might need a POST endpoint to update history
            // For now, history is auto-updated when records are created
            console.warn('saveHistory: history is auto-managed by backend');
            return history;
        } catch (error) {
            console.error('Failed to save attendance history:', error);
            throw error;
        }
    },

    // Remove records older than maxAgeMs and update history checkout times
    async purgeExpiredRecords(maxAgeMs = 2 * 60 * 60 * 1000) {
        try {
            // This should be handled by backend scheduled jobs
            // For now, we'll implement client-side filtering
            const records = await this.listRecords();
            const now = Date.now();

            if (!Array.isArray(records) || records.length === 0) {
                return { removedKeys: [], updatedRecords: records, updatedHistory: null };
            }

            const keep = [];
            const removedKeys = [];

            for (const rec of records) {
                const checkInMs = rec?.checkedInTime || rec?.checkInAt
                    ? new Date(rec.checkedInTime || rec.checkInAt).getTime()
                    : NaN;
                const age = Number.isFinite(checkInMs) ? now - checkInMs : 0;

                if (!Number.isFinite(checkInMs) || age < maxAgeMs) {
                    keep.push(rec);
                } else {
                    const key = rec.membershipId || rec.phone;
                    if (key) removedKeys.push(key);
                }
            }

            return {
                removedKeys,
                updatedRecords: keep,
                updatedHistory: null
            };
        } catch (error) {
            console.error('Failed to purge expired records:', error);
            return { removedKeys: [], updatedRecords: [], updatedHistory: null };
        }
    },

    async clearRecords() {
        try {
            const response = await apiClient.delete('/attendance/records/all');
            return response;
        } catch (error) {
            console.error('Failed to clear records:', error);
            throw error;
        }
    }
};
