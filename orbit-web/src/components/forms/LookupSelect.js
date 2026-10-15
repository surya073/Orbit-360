import React, { useState } from 'react';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { LOOKUPS } from '../../hooks/useLookup';
import { resourceService } from '../../services/resourceService';
import Combobox from './Combobox';

const LIMIT = 50;

/**
 * Foreign-key picker: a searchable dropdown backed by server-side search (up to 50 matches per
 * query, so it stays cheap with thousands of rows). Options are only requested once the control is
 * opened, and the selected record's name is resolved with one `ids` lookup. `compact` is kept for
 * the filter bars' existing call sites.
 */
export default function LookupSelect({ column, value, onChange, controlProps = {}, disabled, placeholder = 'Search or select…' }) {
	const [resource, labelCol] = LOOKUPS[column];
	const [opened, setOpened] = useState(false);
	const [q, setQ] = useState('');
	const dq = useDebouncedValue(q, 300);

	const list = useApiResource((signal) => resourceService.list(resource, { q: dq, pageSize: LIMIT }, { signal }), `${resource}|${dq}`, { enabled: opened, isEmpty: () => false });
	const options = (list.data || []).map((o) => ({ value: String(o.ROWID), label: String(o[labelCol] ?? `#${o.ROWID}`) }));

	// The chosen record may not be among the current matches: resolve its name on its own.
	const known = options.find((o) => o.value === String(value));
	const selected = useApiResource((signal) => resourceService.list(resource, { ids: String(value), pageSize: 1 }, { signal }), `${resource}|id|${value}`, { enabled: Boolean(value) && !known, isEmpty: () => false });
	const resolved = selected.data && selected.data[0] ? String(selected.data[0][labelCol] ?? '') : '';
	const label = value ? (known && known.label) || resolved || (selected.status === 'loading' ? 'Loading…' : `#${value}`) : '';

	return (
		<Combobox
			value={value || ''}
			label={label}
			options={options}
			loading={list.status === 'loading'}
			error={list.status === 'error' ? list.error.message : undefined}
			placeholder={placeholder}
			disabled={disabled}
			emptyText={dq ? `No ${resource.replace(/_/g, ' ')} match “${dq}”` : `No ${resource.replace(/_/g, ' ')} found`}
			onOpen={() => setOpened(true)}
			onQuery={setQ}
			onChange={(v) => {
				setQ('');
				onChange(v);
			}}
			inputProps={{ 'aria-label': controlProps['aria-label'], ...controlProps }}
		/>
	);
}
