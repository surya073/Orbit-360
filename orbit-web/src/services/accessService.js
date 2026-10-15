import { api } from './apiClient';

/** Roles, permissions and user access. Every call is authorized by the backend from the signed-in user's own permissions. */
export const accessService = {
	catalog: (o) => api.get('/access/catalog', o),
	roles: (o) => api.get('/access/roles', o),
	createRole: (body) => api.post('/access/roles', body),
	updateRole: (ref, body) => api.patch(`/access/roles/${ref}`, body),
	setPermissions: (ref, permissions) => api.put(`/access/roles/${ref}/permissions`, { permissions }),
	users: (params, o) => api.get('/access/users', { ...o, params }),
	updateUser: (id, body) => api.patch(`/access/users/${id}`, body),
};
