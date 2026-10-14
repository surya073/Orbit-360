import React, { useState } from 'react';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { LOOKUPS } from '../../hooks/useLookup';
import { resourceService } from '../../services/resourceService';

const LIMIT = 50;

/**
 * Foreign-key picker backed by server-side search: a native <select> of up to 50 matches, with a
 * search box that narrows it (keyboard and screen-reader friendly, works with thousands of rows).
 * `compact` (used in filter bars) hides the search box until there are more than 50 options.
 */
export default function LookupSelect({ column, value, onChange, controlProps, disabled, placeholder = 'Select…', compact = false }) {
	const [resource, labelCol] = LOOKUPS[column];
	const [q, setQ] = useState('');
	const dq = useDebouncedValue(q, 300);
	const res = useApiResource((signal) => resourceService.list(resource, { q: dq, pageSize: LIMIT }, { signal }), `${resource}|${dq}`, { isEmpty: () => false });
	const options = res.data || [];
	const hasSelected = options.some((o) => String(o.ROWID) === String(value));
	const showSearch = !compact || q !== '' || (res.meta && res.meta.total > LIMIT);

	return (
		<div style={{ display: 'grid', gap: 4 }}>
			{showSearch ? <input type="search" aria-label={`Search ${resource.replace(/_/g, ' ')}`} placeholder="Type to search…" value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} /> : null}
			<select {...controlProps} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
				<option value="">{res.status === 'loading' && !res.data ? 'Loading…' : placeholder}</option>
				{value && !hasSelected ? <option value={value}>#{value}</option> : null}
				{options.map((o) => (
					<option key={o.ROWID} value={o.ROWID}>
						{o[labelCol]}
					</option>
				))}
			</select>
			{res.status === 'error' ? <span className="field-error">Could not load options: {res.error.message}</span> : null}
		</div>
	);
}
