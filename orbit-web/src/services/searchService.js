import { SEARCH_RESULTS_PER_GROUP } from '../config/constants';
import { ROUTES } from '../config/routes';
import { resourceService } from './resourceService';

// Searchable sources = list endpoints that support a text `q` filter. The backend applies
// authorization and team scope to each, so results only contain what the caller may see.
export const SEARCH_SOURCES = [
	{ key: 'employees', resource: 'employees', label: 'Employees', route: ROUTES.employees, title: (r) => r.full_name, detail: (r) => r.job_role || r.employee_code || '' },
	{ key: 'projects', resource: 'projects', label: 'Projects', route: ROUTES.projects, title: (r) => r.project_name, detail: (r) => r.project_code || r.current_status || '' },
	{ key: 'product', resource: 'product_items', label: 'Product items', route: ROUTES.product, title: (r) => r.title, detail: (r) => r.item_type || '' },
	{ key: 'usage', resource: 'ai_usage_records', label: 'AI & GitHub usage', route: ROUTES.usage, title: (r) => r.tool_name, detail: (r) => r.tool_category || '' },
];

/**
 * Runs one request per source in parallel. A failing source is reported as `error` for that
 * group only, so one outage never hides the others. Resolves to [{ source, items, error }].
 */
export async function searchAll(q, signal) {
	const settled = await Promise.allSettled(SEARCH_SOURCES.map((s) => resourceService.list(s.resource, { q, pageSize: SEARCH_RESULTS_PER_GROUP }, { signal })));
	if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
	return SEARCH_SOURCES.map((source, i) => {
		const r = settled[i];
		if (r.status === 'fulfilled') return { source, items: r.value.data.map((row) => ({ id: row.ROWID, title: source.title(row), detail: source.detail(row) })), error: null };
		return { source, items: [], error: r.reason };
	});
}
