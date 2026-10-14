import { api } from './apiClient';

// Import lifecycle: createJob -> preview batches -> (resolve conflicts) -> commit batches -> complete.
export const importsService = {
	templates: (o) => api.get('/imports/templates', o),
	createJob: (body) => api.post('/imports/jobs', body),
	getJob: (id, o) => api.get(`/imports/jobs/${id}`, o),
	listRows: (id, params, o) => api.get(`/imports/jobs/${id}/rows`, { ...o, params }),
	preview: (id, rows) => api.post(`/imports/jobs/${id}/preview`, { rows }),
	resolve: (id, resolutions) => api.post(`/imports/jobs/${id}/resolve`, { resolutions }),
	commit: (id, rows) => api.post(`/imports/jobs/${id}/commit`, { rows }),
	complete: (id) => api.post(`/imports/jobs/${id}/complete`, {}),
	cancel: (id) => api.post(`/imports/jobs/${id}/cancel`, {}),
};
