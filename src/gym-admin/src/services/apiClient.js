export const performanceApi = {
    get: (year, month) => {
        let params = '';
        if (year && month) {
            params = `?year=${year}&month=${month}`;
        }
        return request(`/api/performance${params}`);
    },
    setTarget: (year, month, target) => {
        return request('/api/performance/target', {
            method: 'POST',
            body: JSON.stringify({ year, month, target })
        });
    },
    getTargetHistory: () => {
        return request('/api/performance/target-history');
    }
};
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050').replace(/\/$/, '');

const defaultHeaders = {
    'Content-Type': 'application/json'
};

async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        });
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error('Unable to reach the API server. Please confirm the gym-api service is running.');
        }
        throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        const errorMessage = isJson ? payload.error || JSON.stringify(payload) : payload;
        throw new Error(errorMessage || `Request failed with status ${response.status}`);
    }

    return payload;
}

export const membershipsApi = {
    list: async (category) => {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        return request(`/api/memberships${params}`);
    },
    history: (limit = 25) => {
        const parsedLimit = Number(limit);
        const params = parsedLimit && parsedLimit > 0 ? `?limit=${parsedLimit}` : '';
        return request(`/api/memberships/history${params}`);
    },
    clearHistory: () => request('/api/memberships/history', {
        method: 'DELETE'
    }),
    // Ensure required fields for legacy API by auto-filling placeholders
    create: (data) => {
        const payload = {
            name: data?.name ?? 'Plan Template',
            phone: data?.phone ?? '0000000000',
            email: data?.email ?? '',
            category: data?.category ?? '',
            label: data?.label ?? '',
            price: data?.price ?? data?.amount ?? null,
            original: data?.original ?? null,
            tag: data?.tag ?? null,
            preferredDate: data?.preferredDate ?? null,
            paymentMode: data?.paymentMode ?? undefined,
            remarks: data?.remarks ?? ''
        };
        // Clean optional empty values to avoid backend validation issues
        if (!payload.email) delete payload.email;
        if (!payload.paymentMode) delete payload.paymentMode;
        if (payload.preferredDate === null) delete payload.preferredDate;
        if (!payload.remarks) delete payload.remarks;
        return request('/api/memberships', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    update: (id, data) => request(`/api/memberships/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    remove: (id) => request(`/api/memberships/${id}`, {
        method: 'DELETE'
    })
};

export const trainersApi = {
    list: () => request('/api/trainers'),
    create: (data) => request('/api/trainers', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/trainers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    remove: (id) => request(`/api/trainers/${id}`, {
        method: 'DELETE'
    })
};

export const pitchesApi = {
    list: (date) => {
        const params = date ? `?date=${encodeURIComponent(date)}` : '';
        return request(`/api/pitches${params}`);
    },
    create: (data) => request('/api/pitches', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

export const reportsApi = {
    list: () => request('/api/reports')
};

export const leadsApi = {
    // The backend exposes a simple leads listing at /api/leads,
    // expose the same endpoint here so the admin reports can reuse the canonical data.
    list: () => request('/api/leads')
};

// Config endpoints for site-wide settings (e.g., benefits)
export const configApi = {
    getBenefits: async (category = 'premium') => request(`/api/config/benefits?category=${encodeURIComponent(category)}`),
    setBenefits: async (category, items) => request('/api/config/benefits', {
        method: 'PUT',
        body: JSON.stringify({ category, items })
    })
};

// Monthly reports and archiving
export const monthlyReportsApi = {
    archive: async (year, month) => request('/api/monthly-reports/archive', {
        method: 'POST',
        body: JSON.stringify({ year, month })
    }),
    getNewMembers: async (year, month, page = 1, limit = 10) => {
        const params = `?year=${year}&month=${month}&page=${page}&limit=${limit}`;
        return request(`/api/monthly-reports/new-members${params}`);
    }
};
