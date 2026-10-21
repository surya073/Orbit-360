import { api } from './apiClient';

/** Backend-computed metrics. The UI never derives KPIs from raw records. */
export const dashboardService = {
	// the whole dashboard in one request (one function invocation instead of six)
	bundle: (params, o) => api.get('/dashboard/bundle', { ...o, params }),
	overview: (params, o) => api.get('/dashboard/overview', { ...o, params }),
	trends: (params, o) => api.get('/dashboard/trends', { ...o, params }),
	projects: (params, o) => api.get('/dashboard/projects', { ...o, params }),
	product: (params, o) => api.get('/dashboard/product', { ...o, params }),
	aiUsage: (params, o) => api.get('/dashboard/ai-usage', { ...o, params }),
	peopleProfiles: (params, o) => api.get('/dashboard/people-profiles', { ...o, params }),
	freshness: (params, o) => api.get('/dashboard/freshness', { ...o, params }),
	createSnapshot: (filters) => api.post('/dashboard/snapshots', filters),
	listSnapshots: (params, o) => api.get('/dashboard/snapshots', { ...o, params }),
	getSnapshot: (id, o) => api.get(`/dashboard/snapshots/${id}`, o),
};
