import { useCallback, useEffect, useState } from 'react';
import { sanitizeCell, sanitizeStore } from './sheetFormat';

const storageKey = (resource) => `company360.sheetFormat.${resource}`;
const MAX_STORED_CELLS = 4000;

function load(resource) {
	try {
		return sanitizeStore(JSON.parse(window.localStorage.getItem(storageKey(resource)) || '{}'));
	} catch {
		return {};
	}
}

function persist(resource, formats) {
	try {
		// Rows that are not saved yet (n:...) have no stable identity, so only records are remembered.
		const out = {};
		let cells = 0;
		for (const [key, fields] of Object.entries(formats)) {
			if (!key.startsWith('r:')) continue;
			const n = Object.keys(fields).length;
			if (cells + n > MAX_STORED_CELLS) break;
			cells += n;
			out[key] = fields;
		}
		if (Object.keys(out).length) window.localStorage.setItem(storageKey(resource), JSON.stringify(out));
		else window.localStorage.removeItem(storageKey(resource));
	} catch {
		/* storage unavailable or full: formatting still works for this visit */
	}
}

/**
 * Device-local cell formatting for one record type: { rowKey: { field: { b, i, wrap, align, size,
 * color, fill, link } } }. Only the touched row objects change identity, so memoised grid rows
 * re-render only when their own formatting changes. Nothing here is ever sent to the backend.
 */
export default function useSheetFormat(resource) {
	const [formats, setFormats] = useState(() => load(resource));

	useEffect(() => {
		persist(resource, formats);
	}, [resource, formats]);

	/** patch: { b: true } sets, { b: null } removes. cells: [{ key, field }] */
	const apply = useCallback((cells, patch) => {
		setFormats((prev) => {
			const next = { ...prev };
			for (const { key, field } of cells) {
				const row = { ...(next[key] || {}) };
				const merged = { ...(row[field] || {}), ...patch };
				for (const k of Object.keys(merged)) if (merged[k] === null || merged[k] === undefined || merged[k] === false || merged[k] === '') delete merged[k];
				const clean = key.startsWith('r:') ? sanitizeCell(merged) : merged; // saved records are validated; transient rows are in-memory only
				if (clean && Object.keys(clean).length) row[field] = clean;
				else delete row[field];
				if (Object.keys(row).length) next[key] = row;
				else delete next[key];
			}
			return next;
		});
	}, []);

	const clear = useCallback((cells) => {
		setFormats((prev) => {
			const next = { ...prev };
			for (const { key, field } of cells) {
				if (!next[key]) continue;
				const row = { ...next[key] };
				delete row[field];
				if (Object.keys(row).length) next[key] = row;
				else delete next[key];
			}
			return next;
		});
	}, []);

	return { formats, apply, clear };
}
