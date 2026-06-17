import apiClient from './apiClient';

const BASE_PATH = '/user-memberships';

export const userMembershipsService = {
    list: () => apiClient.get(BASE_PATH).then((res) => res.data || res),
    create: (payload) => apiClient.post(BASE_PATH, payload).then((res) => res.data || res),
};