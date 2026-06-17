// HTTP client wrapper to handle API requests
const rawBaseUrl = process.env.REACT_APP_GYM_API_URL || 'http://localhost:5050';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

// Constructs URL, adding /api prefix by default but preserving root-mounted paths
const buildUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const rootMountedPaths = [];
    if (rootMountedPaths.some((p) =>
        normalizedPath === p || normalizedPath.startsWith(`${p}/`)
    )) {
        return `${API_BASE_URL}${normalizedPath}`;
    }
    const hasApiPrefix = normalizedPath.startsWith('/api');
    return `${API_BASE_URL}${hasApiPrefix ? normalizedPath : `/api${normalizedPath}`}`;
};

const defaultHeaders = {
    'Content-Type': 'application/json',
};

// Parses response, throws on error, returns JSON or null for 204
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = new Error(errorBody.error || errorBody.message || 'Request failed');
        error.status = response.status;
        error.body = errorBody;
        throw error;
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

// Default export of apiClient for simple imports
const apiClient = {
    async get(path, options = {}) {
        const response = await fetch(buildUrl(path), {
            method: 'GET',
            headers: defaultHeaders,
            ...options,
        });
        return handleResponse(response);
    },
    async post(path, body, options = {}) {
        const response = await fetch(buildUrl(path), {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify(body),
            ...options,
        });
        return handleResponse(response);
    },
    async patch(path, body, options = {}) {
        const response = await fetch(buildUrl(path), {
            method: 'PATCH',
            headers: defaultHeaders,
            body: JSON.stringify(body),
            ...options,
        });
        return handleResponse(response);
    },
    // HTTP PUT alias for updating resources
    async put(path, body, options = {}) {
        const response = await fetch(buildUrl(path), {
            method: 'PUT',
            headers: defaultHeaders,
            body: JSON.stringify(body),
            ...options,
        });
        return handleResponse(response);
    },
    async delete(path, options = {}) {
        const response = await fetch(buildUrl(path), {
            method: 'DELETE',
            headers: defaultHeaders,
            ...options,
        });
        return handleResponse(response);
    },
};
// Export default apiClient for simple imports
export default apiClient;
