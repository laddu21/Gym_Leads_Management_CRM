import apiClient from './apiClient';

const BASE = '/leads';

export const leadsService = {
    list: () => apiClient.get(BASE),
    create: (payload) => apiClient.post(BASE, payload),
    update: (payload) => apiClient.put(BASE, payload)
};
