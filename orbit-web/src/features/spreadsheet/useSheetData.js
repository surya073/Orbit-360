import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import useApiResource from '../../hooks/useApiResource';
import { resourceService } from '../../services/resourceService';
import { buildColumns, normalizeCell, toText } from './gridModel';

export const SHEET_PAGE_SIZE = 50;
const SAVE_CONCURRENCY = 3;
const HISTORY_LIMIT = 100;
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));

export const rowKeyOf = (id) => `r:${id}`;
const isNewKey = (key) => key.startsWith('n:');

const initial = { edits: {}, newRows: [], errors: {}, undo: [], redo: [], counter: 0 };

const withEdit = (edits, id, field, value) => {
	const row = { ...(edits[id] || {}) };
	if (value === undefined) delete row[field];
	else row[field] = value;
	const next = { ...edits };
	if (Object.keys(row).length) next[id] = row;
	else delete next[id];
	return next;
};

/** Applies (or reverts) one history entry to the state. */
function applyOp(state, op, direction) {
	const forward = direction === 'redo';
	switch (op.type) {
		case 'cells': {
			let { edits, newRows } = state;
			for (const c of op.changes) {
				const value = forward ? c.after : c.before;
				if (isNewKey(c.key)) newRows = newRows.map((r) => (r.key === c.key ? { ...r, values: { ...r.values, [c.field]: value ?? '' } } : r));
				else edits = withEdit(edits, c.key.slice(2), c.field, value);
			}
			return { ...state, edits, newRows };
		}
		case 'addRows': {
			const keys = new Set(op.rows.map((r) => r.key));
			return { ...state, newRows: forward ? [...state.newRows, ...op.rows] : state.newRows.filter((r) => !keys.has(r.key)) };
		}
		case 'removeRows': {
			const keys = new Set(op.rows.map((r) => r.key));
			return { ...state, newRows: forward ? state.newRows.filter((r) => !keys.has(r.key)) : [...state.newRows, ...op.rows] };
		}
		default:
			return state;
	}
}

function reducer(state, a) {
	switch (a.type) {
		case 'op': {
			const next = applyOp(state, a.op, 'redo');
			const errors = { ...state.errors };
			for (const c of a.op.changes || []) if (errors[c.key]) delete errors[c.key][c.field];
			return { ...next, errors, undo: [...state.undo, a.op].slice(-HISTORY_LIMIT), redo: [] };
		}
		case 'undo': {
			const op = state.undo[state.undo.length - 1];
			return op ? { ...applyOp(state, op, 'undo'), undo: state.undo.slice(0, -1), redo: [...state.redo, op] } : state;
		}
		case 'redo': {
			const op = state.redo[state.redo.length - 1];
			return op ? { ...applyOp(state, op, 'redo'), redo: state.redo.slice(0, -1), undo: [...state.undo, op] } : state;
		}
		case 'counter':
			return { ...state, counter: state.counter + a.n };
		case 'errors':
			return { ...state, errors: a.errors };
		case 'saved': {
			// Remove what the server confirmed; everything else (failed rows) stays editable.
			let edits = state.edits;
			for (const id of a.updatedIds) {
				const { [id]: _gone, ...rest } = edits;
				edits = rest;
			}
			const created = new Set(a.createdKeys);
			return { ...state, edits, newRows: state.newRows.filter((r) => !created.has(r.key)), errors: a.errors, undo: [], redo: [] };
		}
		case 'drop-edits': {
			const edits = { ...state.edits };
			a.ids.forEach((id) => delete edits[id]);
			return { ...state, edits, undo: [], redo: [] };
		}
		case 'discard':
			return { ...initial, counter: state.counter };
		default:
			return state;
	}
}

/**
 * State and persistence for the spreadsheet editor, on top of the existing record API
 * (resourceService list/create/update/remove). Edits are tracked per cell and only changed
 * fields are sent. Nothing is reported as saved until the backend confirms it.
 */
export default function useSheetData({ resource, template, canWrite, search = '', page = 1 }) {
	const params = useMemo(() => ({ page, pageSize: SHEET_PAGE_SIZE, ...(search ? { q: search } : {}) }), [page, search]);
	const res = useApiResource((signal) => resourceService.list(resource, params, { signal }), `sheet|${resource}|${JSON.stringify(params)}`, { enabled: Boolean(template), isEmpty: () => false });
	const rows = useMemo(() => res.data || [], [res.data]);
	const [state, dispatch] = useReducer(reducer, initial);
	const [saveState, setSaveState] = useState({ status: 'idle', at: null, summary: null });
	const saving = useRef(false);

	// Baseline = the server values as last loaded (page-independent, so edits survive paging).
	const baseline = useRef(new Map());
	rows.forEach((r) => baseline.current.set(String(r.ROWID), r));

	const columns = useMemo(() => buildColumns(template, rows), [template, rows]);
	const colByField = useMemo(() => Object.fromEntries(columns.map((c) => [c.field, c])), [columns]);

	// A different module starts a clean sheet.
	useEffect(() => {
		baseline.current = new Map();
		dispatch({ type: 'discard' });
		setSaveState({ status: 'idle', at: null, summary: null });
	}, [resource]);

	const baseText = useCallback((id, field) => toText((baseline.current.get(String(id)) || {})[field]), []);

	const valueOf = useCallback(
		(key, field) => {
			if (isNewKey(key)) return ((state.newRows.find((r) => r.key === key) || {}).values || {})[field] ?? '';
			const id = key.slice(2);
			const e = state.edits[id];
			return e && field in e ? e[field] : toText((baseline.current.get(id) || {})[field]);
		},
		[state.edits, state.newRows]
	);

	/**
	 * Applies typed/pasted cell changes: [{ key, field, text }]. Returns { applied, rejected } where
	 * rejected = [{ key, field, reason }]; rejected cells are left untouched.
	 */
	const setCells = useCallback(
		(changes) => {
			const done = [];
			const rejected = [];
			for (const { key, field, text } of changes) {
				const col = colByField[field];
				if (!col) continue;
				const n = normalizeCell(col, text);
				if (n.error) {
					rejected.push({ key, field, reason: `${col.label}: ${n.error}` });
					continue;
				}
				if (isNewKey(key)) {
					const before = ((state.newRows.find((r) => r.key === key) || {}).values || {})[field] ?? '';
					if (before !== n.value) done.push({ key, field, before, after: n.value });
					continue;
				}
				const id = key.slice(2);
				const base = baseText(id, field);
				if (col.immutable) {
					rejected.push({ key, field, reason: `${col.label} cannot be changed after the record is created` });
					continue;
				}
				if (n.value === '' && base !== '') {
					rejected.push({ key, field, reason: `${col.label}: a saved value cannot be cleared (the API only accepts new values)` });
					continue;
				}
				const current = state.edits[id] && field in state.edits[id] ? state.edits[id][field] : undefined;
				const after = n.value === base ? undefined : n.value;
				if (current !== after) done.push({ key, field, before: current, after });
			}
			if (done.length) dispatch({ type: 'op', op: { type: 'cells', changes: done } });
			return { applied: done.length, rejected };
		},
		[colByField, baseText, state.edits, state.newRows]
	);

	const addRows = useCallback(
		(count = 1) => {
			const rowsToAdd = Array.from({ length: count }, (_, i) => ({ key: `n:${state.counter + i + 1}`, values: {} }));
			dispatch({ type: 'counter', n: count });
			dispatch({ type: 'op', op: { type: 'addRows', rows: rowsToAdd } });
			return rowsToAdd.map((r) => r.key);
		},
		[state.counter]
	);

	const removeNewRows = useCallback(
		(keys) => {
			const set = new Set(keys);
			const rowsToRemove = state.newRows.filter((r) => set.has(r.key));
			if (rowsToRemove.length) dispatch({ type: 'op', op: { type: 'removeRows', rows: rowsToRemove } });
		},
		[state.newRows]
	);

	const isBlankNew = useCallback((r) => !Object.values(r.values).some((v) => v !== ''), []);
	const dirtyIds = Object.keys(state.edits);
	const filledNew = state.newRows.filter((r) => !isBlankNew(r));
	const dirtyCount = dirtyIds.length + filledNew.length;

	/** Save every pending change. `overwrite` skips the "changed on the server" check. */
	const save = useCallback(
		async ({ overwrite = false } = {}) => {
			if (!canWrite || saving.current) return null;
			saving.current = true;
			setSaveState((s) => ({ ...s, status: 'saving' }));
			const errors = {};
			const addErr = (key, field, msg) => {
				errors[key] = { ...(errors[key] || {}), [field]: msg };
			};
			const summary = { created: 0, updated: 0, failed: 0, conflicts: 0, invalid: 0 };
			const createdKeys = [];
			const updatedIds = [];
			try {
				// 1. validate new rows (required fields), skipping entirely blank rows
				const toCreate = [];
				for (const r of filledNew) {
					let ok = true;
					for (const c of columns) {
						if (c.required && (r.values[c.field] ?? '') === '') {
							ok = false;
							addErr(r.key, c.field, 'Required');
						}
					}
					if (ok) toCreate.push(r);
					else summary.invalid++;
				}
				// 2. conflict check: has anyone changed the fields we edited since we loaded them?
				const toUpdate = [];
				const ids = Object.keys(state.edits);
				const current = new Map();
				if (ids.length) {
					for (const part of chunk(ids, 100)) {
						const out = await resourceService.list(resource, { ids: part.join(','), pageSize: 100 }, { fresh: true });
						out.data.forEach((r) => current.set(String(r.ROWID), r));
					}
				}
				for (const id of ids) {
					const key = rowKeyOf(id);
					const server = current.get(id);
					if (!server) {
						addErr(key, '_row', 'This record no longer exists (it may have been deleted). Your edits are kept.');
						summary.conflicts++;
						continue;
					}
					let conflict = false;
					for (const field of Object.keys(state.edits[id])) {
						if (!overwrite && toText(server[field]) !== baseText(id, field)) {
							addErr(key, field, `Changed on the server to "${toText(server[field]) || 'blank'}" since you loaded it`);
							conflict = true;
						}
					}
					if (conflict) summary.conflicts++;
					else toUpdate.push(id);
				}
				// 3. write with bounded concurrency; one record failing never blocks the rest
				const jobs = [
					...toCreate.map((r) => async () => {
						try {
							const payload = Object.fromEntries(Object.entries(r.values).filter(([, v]) => v !== ''));
							await resourceService.create(resource, payload);
							createdKeys.push(r.key);
							summary.created++;
						} catch (e) {
							summary.failed++;
							const fe = e.fieldErrors || {};
							if (Object.keys(fe).length) Object.entries(fe).forEach(([f, m]) => addErr(r.key, f, m));
							else addErr(r.key, '_row', e.message);
						}
					}),
					...toUpdate.map((id) => async () => {
						try {
							await resourceService.update(resource, id, state.edits[id]);
							updatedIds.push(id);
							summary.updated++;
						} catch (e) {
							summary.failed++;
							const fe = e.fieldErrors || {};
							if (Object.keys(fe).length) Object.entries(fe).forEach(([f, m]) => addErr(rowKeyOf(id), f, m));
							else addErr(rowKeyOf(id), '_row', e.message);
						}
					}),
				];
				let next = 0;
				await Promise.all(
					Array.from({ length: Math.min(SAVE_CONCURRENCY, jobs.length) }, async () => {
						while (next < jobs.length) {
							const job = jobs[next++];
							await job();
						}
					})
				);
				// Show the confirmed values straight away; the reload below refreshes them from the server.
				updatedIds.forEach((id) => baseline.current.set(id, { ...baseline.current.get(id), ...state.edits[id] }));
				dispatch({ type: 'saved', createdKeys, updatedIds, errors });
				if (createdKeys.length || updatedIds.length) res.reload();
				const failedAny = summary.failed + summary.conflicts + summary.invalid > 0;
				setSaveState({ status: failedAny ? 'partial' : 'saved', at: new Date(), summary });
				return summary;
			} catch (e) {
				// e.g. the conflict-check request failed: nothing was written, all edits are kept
				setSaveState({ status: 'error', at: new Date(), summary: { message: e.message } });
				return { error: e.message };
			} finally {
				saving.current = false;
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[canWrite, columns, state.edits, state.newRows, resource, baseText, res.reload]
	);

	const deleteRecords = useCallback(
		async (ids) => {
			const failed = [];
			for (const id of ids) {
				try {
					await resourceService.remove(resource, id);
				} catch (e) {
					failed.push(e.message);
				}
			}
			dispatch({ type: 'drop-edits', ids });
			res.reload();
			if (failed.length) throw new Error(`${failed.length} of ${ids.length} could not be deleted: ${failed[0]}`);
		},
		[resource, res]
	);

	return {
		res,
		rows,
		columns,
		state,
		valueOf,
		baseText,
		setCells,
		addRows,
		removeNewRows,
		undo: () => dispatch({ type: 'undo' }),
		redo: () => dispatch({ type: 'redo' }),
		canUndo: state.undo.length > 0,
		canRedo: state.redo.length > 0,
		discard: () => {
			dispatch({ type: 'discard' });
			setSaveState({ status: 'idle', at: null, summary: null });
		},
		save,
		saveState,
		deleteRecords,
		dirtyCount,
		hasConflicts: Object.values(state.errors).some((e) => Object.values(e).some((m) => String(m).startsWith('Changed on the server'))),
	};
}
