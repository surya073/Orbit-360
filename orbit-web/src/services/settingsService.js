import { api } from './apiClient';

export const settingsService = {
	list: (o) => api.get('/settings', o),
	upsert: (body) => api.put('/settings', body),
};
