import { seedLookup } from '../utils/lookupCache';
import { api } from './apiClient';

// Resource names (Data Store table names, used by UI configs) -> REST path segment.
export const RESOURCE_PATHS = {
	teams: 'teams',
	employees: 'employees',
	projects: 'projects',
	project_assignments: 'project-assignments',
	time_entries: 'time-entries',
	attendance_records: 'attendance',
	leave_records: 'leave',
	performance_records: 'performance',
	ai_usage_records: 'ai-usage',
	product_items: 'product-items',
	metric_definitions: 'metric-definitions',
};

const path = (resource) => {
	const p = RESOURCE_PATHS[resource];
	if (!p) throw new Error(`Unknown resource ${resource}`);
	return `/${p}`;
};

/** Generic access to the paginated, team-scoped record endpoints. */
export const resourceService = {
	list: (resource, params, o) => {
		const req = api.get(path(resource), { ...o, params });
		// A full, unfiltered team list is what every page needs to turn team ids into names: keep the names so no page asks for them again.
		if (resource === 'teams' && !(params && (params.ids || params.search || params.q))) req.then((res) => seedLookup('teams', res && res.data)).catch(() => {});
		return req;
	},
	get: (resource, id, o) => api.get(`${path(resource)}/${id}`, o),
	create: (resource, body) => api.post(path(resource), body),
	update: (resource, id, body) => api.patch(`${path(resource)}/${id}`, body),
	remove: (resource, id) => api.delete(`${path(resource)}/${id}`),
	decideTimeEntry: (id, status) => api.post(`/time-entries/${id}/decision`, { status }),
};
