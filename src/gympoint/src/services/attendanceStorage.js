const ATTENDANCE_STORAGE_KEY = 'gym-dashboard:attendance';
const ATTENDANCE_HISTORY_STORAGE_KEY = 'gym-dashboard:attendance-history';

const normalizeAttendancePhone = (value = '') => {
    if (!value) {
        return '';
    }
    const digits = value.toString().replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits || value.toString().trim();
};

const loadAttendanceRecords = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Unable to load attendance records', error);
        return [];
    }
};

const saveAttendanceRecords = (records) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('Unable to persist attendance records', error);
    }
};

const loadAttendanceHistory = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(ATTENDANCE_HISTORY_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }

        const normalized = {};
        Object.entries(parsed).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                normalized[key] = {
                    entries: value.slice(0, 5),
                    totalCount: value.length
                };
                return;
            }
            const entries = Array.isArray(value?.entries) ? value.entries.slice(0, 5) : [];
            const totalCount = Number.isFinite(value?.totalCount) ? value.totalCount : entries.length;
            normalized[key] = {
                entries,
                totalCount: Math.max(totalCount, entries.length)
            };
        });

        return normalized;
    } catch (error) {
        console.error('Unable to load attendance history', error);
        return {};
    }
};

const saveAttendanceHistory = (history) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        const payload = history && typeof history === 'object' ? history : {};
        window.localStorage.setItem(ATTENDANCE_HISTORY_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('Unable to persist attendance history', error);
    }
};

export {
    ATTENDANCE_STORAGE_KEY,
    ATTENDANCE_HISTORY_STORAGE_KEY,
    loadAttendanceRecords,
    saveAttendanceRecords,
    loadAttendanceHistory,
    saveAttendanceHistory,
    normalizeAttendancePhone
};
