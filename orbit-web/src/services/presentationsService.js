import { api } from './apiClient';

export const presentationsService = {
	list: (params, o) => api.get('/presentations', { ...o, params }),
	get: (id, o) => api.get(`/presentations/${id}`, o),
	create: (body) => api.post('/presentations', body),
	update: (id, body) => api.patch(`/presentations/${id}`, body),
	remove: (id) => api.delete(`/presentations/${id}`),
	markPresented: (id) => api.post(`/presentations/${id}/presented`, {}),
};
