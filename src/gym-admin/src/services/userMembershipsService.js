import { membershipsApi } from './apiClient';


const BASE_PATH = '/user-memberships';

// You may want to implement userMembershipsService using membershipsApi or similar logic
// For now, provide a stub that throws to avoid silent errors
export const userMembershipsService = {
    list: () => membershipsApi.list(),
    create: (payload) => membershipsApi.create(payload),
};
