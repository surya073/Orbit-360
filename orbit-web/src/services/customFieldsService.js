import { api } from './apiClient';

/** Definitions of the extra spreadsheet/form columns (table custom_fields). Values live in each record's more_details. */
export const customFieldsService = {
	list: (module, o) => api.get('/custom-fields', { ...o, params: { module, pageSize: 100 } }),
	create: (body) => api.post('/custom-fields', body),
	update: (id, body) => api.patch(`/custom-fields/${id}`, body),
	remove: (id) => api.delete(`/custom-fields/${id}`),
};
