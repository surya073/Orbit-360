import { useEffect, useState } from 'react';
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

	// Writes { key, field, cell } entries (cell null = no formatting) into a copy of the store.
	const writeCells = (prev, entries) => {
		const next = { ...prev };
		for (const { key, field, cell } of entries) {
			const row = { ...(next[key] || {}) };
			if (cell && Object.keys(cell).length) row[field] = cell;
			else delete row[field];
			if (Object.keys(row).length) next[key] = row;
			else delete next[key];
		}
		return next;
	};
	const cellOf = (key, field) => (formats[key] || {})[field] || null;
	const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

	/**
	 * patch: { b: true } sets, { b: null } removes. cells: [{ key, field }].
	 * Returns what actually changed ([{ key, field, before, after }]) so the caller can record it for undo.
	 */
	const apply = (cells, patch) => {
		const changes = [];
		for (const { key, field } of cells) {
			const before = cellOf(key, field);
			const merged = { ...(before || {}), ...patch };
			for (const k of Object.keys(merged)) if (merged[k] === null || merged[k] === undefined || merged[k] === false || merged[k] === '') delete merged[k];
			const clean = key.startsWith('r:') ? sanitizeCell(merged) : merged; // saved records are validated; transient rows are in-memory only
			const after = clean && Object.keys(clean).length ? clean : null;
			if (!same(before, after)) changes.push({ key, field, before, after });
		}
		if (changes.length) setFormats((prev) => writeCells(prev, changes.map((c) => ({ key: c.key, field: c.field, cell: c.after }))));
		return changes;
	};

	const clear = (cells) => {
		const changes = cells.map(({ key, field }) => ({ key, field, before: cellOf(key, field), after: null })).filter((c) => c.before);
		if (changes.length) setFormats((prev) => writeCells(prev, changes.map((c) => ({ key: c.key, field: c.field, cell: null }))));
		return changes;
	};

	/** Re-applies or reverts recorded changes (undo / redo). */
	const restore = (changes, direction) => setFormats((prev) => writeCells(prev, changes.map((c) => ({ key: c.key, field: c.field, cell: direction === 'undo' ? c.before : c.after }))));

	return { formats, apply, clear, restore };
}
