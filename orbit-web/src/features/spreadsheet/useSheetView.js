import { useMemo, useRef } from 'react';
import { displayText, matchesFilter, sortRows } from './gridModel';
import { rowKeyOf } from './useSheetData';

const EMPTY = Object.freeze({});

/**
 * The rows the grid shows: loaded records (after client-side search, filters and sort, which apply
 * to the loaded page only) followed by new unsaved rows, which are never hidden or reordered so
 * they cannot get lost. Each view row carries its stable record key, so sorting and filtering
 * never change which record a cell edits. Row objects are reused while their inputs are unchanged
 * so the grid's memoised rows skip rendering.
 */
// The grid always offers this many rows, like a blank sheet. (A mutable setting so tests can use a small sheet.)
export const sheetConfig = { rows: 500 };
const SLOT_RE = /^n:v\d+$/;

export default function useSheetView({ rows, state, valueOf, columns, sort, filters, query, labelOf, padTo = sheetConfig.rows }) {
	const cache = useRef(new Map());

	return useMemo(() => {
		const colByField = Object.fromEntries(columns.map((c) => [c.field, c]));
		const needle = query.trim().toLowerCase();
		const entries = rows.map((r) => ({ key: rowKeyOf(r.ROWID), id: String(r.ROWID), row: r }));
		const val = (e, field) => valueOf(e.key, field);

		let list = entries.filter((e) => {
			for (const f of filters) {
				const col = colByField[f.field];
				if (col && !matchesFilter(col, f, val(e, f.field), labelOf)) return false;
			}
			if (needle) return columns.some((c) => displayText(c, val(e, c.field), labelOf).toLowerCase().includes(needle) || String(val(e, c.field)).toLowerCase().includes(needle));
			return true;
		});
		if (sort) list = sortRows(list, colByField[sort.field], sort.dir, val);

		const next = new Map();
		const out = [];
		const push = (key, sig, build) => {
			const prev = cache.current.get(key);
			const same = prev && prev.sig.length === sig.length && prev.sig.every((s, i) => s === sig[i]);
			const obj = same ? prev.obj : build();
			next.set(key, { sig, obj });
			out.push(obj);
		};

		list.forEach((e, i) => {
			const edits = state.edits[e.id];
			const errs = state.errors[e.key];
			push(e.key, [e.row, edits, errs, i, columns], () => {
				const values = {};
				columns.forEach((c) => {
					values[c.field] = valueOf(e.key, c.field);
				});
				const { _row, ...fieldErrors } = errs || EMPTY;
				return { key: e.key, id: e.id, isNew: false, number: i + 1, values, dirty: edits || EMPTY, errors: fieldErrors, rowError: _row };
			});
		});
		// Rows typed into the blank area keep their slot (n:v<k>); rows added with 'Add row' follow the loaded records.
		const added = state.newRows.filter((n) => !SLOT_RE.test(n.key));
		const slotRows = new Map(state.newRows.filter((n) => SLOT_RE.test(n.key)).map((n) => [n.key, n]));
		const base = list.length + added.length;
		const highest = [...slotRows.keys()].reduce((m, k) => Math.max(m, Number(k.slice(3))), -1);
		const slots = Math.max(0, padTo - base, highest + 1);
		const newEntries = [...added.map((n, j) => [n, list.length + j]), ...Array.from({ length: slots }, (_, k) => [slotRows.get(`n:v${k}`) || { key: `n:v${k}`, values: EMPTY }, base + k])];
		newEntries.forEach(([n, i]) => {
			const errs = state.errors[n.key];
			push(n.key, [n, errs, i, columns], () => {
				const values = {};
				const dirty = {};
				columns.forEach((c) => {
					values[c.field] = n.values[c.field] ?? '';
					if (values[c.field] !== '') dirty[c.field] = true;
				});
				const { _row, ...fieldErrors } = errs || EMPTY;
				return { key: n.key, id: null, isNew: true, pristine: Object.keys(dirty).length === 0, number: i + 1, values, dirty, errors: fieldErrors, rowError: _row };
			});
		});
		cache.current = next;
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rows, state.edits, state.newRows, state.errors, columns, sort, filters, query, valueOf, labelOf]);
}
