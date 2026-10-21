import { useEffect, useMemo, useState } from 'react';
import { resourceService } from '../services/resourceService';
import { clearLookupCache, lookupCache } from '../utils/lookupCache';

// Foreign-key column -> [resource, label column]. One shared cache across the app.
export const LOOKUPS = {
	employee_id: ['employees', 'full_name'],
	reports_to_employee_id: ['employees', 'full_name'],
	assignee_employee_id: ['employees', 'full_name'],
	project_id: ['projects', 'project_name'],
	team_id: ['teams', 'name'],
	primary_team_id: ['teams', 'name'],
};

const cache = lookupCache; // resource -> { id: label }, shared (and seeded by full lists) via utils/lookupCache
const pending = {}; // resource -> Set of ids being fetched

/**
 * Resolves foreign-key ids on a page of rows to display names with one request per resource
 * (ROWID IN (...)) instead of one per row. Unresolved ids display as "#id". `columns` must be a
 * stable array reference.
 */
export default function useLookupLabels(rows, columns) {
	const [version, setVersion] = useState(0);

	useEffect(() => {
		if (!rows || rows.length === 0) return undefined;
		let live = true;
		const wanted = {};
		for (const col of columns) {
			const def = LOOKUPS[col];
			if (!def) continue;
			for (const r of rows) {
				const id = r[col];
				if (id && !(String(id) in (cache[def[0]] || {})) && !(pending[def[0]] || new Set()).has(String(id))) (wanted[def[0]] ||= new Set()).add(String(id));
			}
		}
		Object.entries(wanted).forEach(([resource, ids]) => {
			const list = [...ids].slice(0, 100);
			(pending[resource] ||= new Set());
			list.forEach((i) => pending[resource].add(i));
			const labelCol = Object.values(LOOKUPS).find(([r]) => r === resource)[1];
			resourceService
				.list(resource, { ids: list.join(','), pageSize: 100 })
				.then(({ data }) => {
					cache[resource] ||= {};
					data.forEach((d) => (cache[resource][String(d.ROWID)] = d[labelCol]));
					// Ids the server did not return (deleted/out of scope) are remembered so they are not asked for again.
					list.forEach((i) => {
						if (!(i in cache[resource])) cache[resource][i] = null;
					});
				})
				.catch(() => {})
				.finally(() => {
					list.forEach((i) => pending[resource].delete(i));
					if (live) setVersion((v) => v + 1);
				});
		});
		return () => {
			live = false;
		};
	}, [rows, columns]);

	return useMemo(
		() => (col, id) => {
			if (!id) return null;
			const def = LOOKUPS[col];
			return (def && (cache[def[0]] || {})[String(id)]) || `#${id}`;
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[version]
	);
}

export const __clearLookupCache = clearLookupCache;
