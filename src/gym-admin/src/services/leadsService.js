
import { leadsApi } from './apiClient';

export const leadsService = {
    list: () => leadsApi.list(),
    // If you need create/update, implement them using the request function in apiClient.js
};
