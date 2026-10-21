import { useMemo } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import { customFieldsService } from '../services/customFieldsService';
import useApiResource from './useApiResource';

/**
 * Extra columns defined for a record type. Cached for ten minutes (one request, shared by the sheet and the forms),
 * and skipped entirely for roles without custom_fields.view. A failed read just means "no extra columns".
 */
export default function useCustomFields(resource) {
	const { can } = useAuth();
	const enabled = Boolean(resource) && can('custom_fields.view');
	const res = useApiResource((signal) => customFieldsService.list(resource, { signal }), `custom|${resource}`, { enabled, isEmpty: () => false });
	const fields = useMemo(() => (res.status === 'success' && Array.isArray(res.data) ? res.data.filter((d) => d.is_active !== false && d.is_active !== 'false') : []), [res.status, res.data]);
	return { fields, enabled, loading: res.status === 'loading', reload: res.reload };
}
