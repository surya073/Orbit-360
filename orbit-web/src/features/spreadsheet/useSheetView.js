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
export default function useSheetView({ rows, state, valueOf, columns, sort, filters, query, labelOf }) {
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
		state.newRows.forEach((n, j) => {
			const errs = state.errors[n.key];
			const i = list.length + j;
			push(n.key, [n, errs, i, columns], () => {
				const values = {};
				const dirty = {};
				columns.forEach((c) => {
					values[c.field] = n.values[c.field] ?? '';
					if (values[c.field] !== '') dirty[c.field] = true;
				});
				const { _row, ...fieldErrors } = errs || EMPTY;
				return { key: n.key, id: null, isNew: true, number: i + 1, values, dirty, errors: fieldErrors, rowError: _row };
			});
		});
		cache.current = next;
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rows, state.edits, state.newRows, state.errors, columns, sort, filters, query, valueOf, labelOf]);
}
