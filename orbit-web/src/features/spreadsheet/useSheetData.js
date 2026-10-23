import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import useApiResource from '../../hooks/useApiResource';
import { useAuth } from '../../app/providers/AuthProvider';
import useCustomFields from '../../hooks/useCustomFields';
import { customFieldsService } from '../../services/customFieldsService';
import { resourceService } from '../../services/resourceService';
import { buildColumns, columnLetter, customColumns, keyFromLabel, normalizeCell, parseExtra, splitCustom, toText, withCustomValues } from './gridModel';

export const SHEET_PAGE_SIZE = 50;
export const SHEET_COLUMNS = 29; // A..AC: the blank columns after the last real one are named by typing in them
const SAVE_CONCURRENCY = 3;
export const AUTOSAVE_MS = 3000; // idle time before an opted-in autosave

// ---- autosave switch (this device; off until the user turns it on) and the unsaved-edits draft ----------------
const AUTOSAVE_KEY = 'company360.sheetAutosave';
export function useAutosaveSetting() {
	const [on, setOn] = useState(() => {
		try {
			return window.localStorage.getItem(AUTOSAVE_KEY) === '1';
		} catch {
			return false;
		}
	});
	const set = useCallback((v) => {
		setOn(v);
		try {
			window.localStorage.setItem(AUTOSAVE_KEY, v ? '1' : '0');
		} catch {
			/* the choice just lasts until the page is closed */
		}
	}, []);
	return [on, set];
}

// The draft lives in sessionStorage: it survives a reload or a crashed tab, but is gone when the tab closes, so
// edited record values are never left behind on a shared computer.
const draftKeyOf = (resource) => `company360.sheetDraft.${resource}`;
function readDraft(resource) {
	try {
		const d = JSON.parse(window.sessionStorage.getItem(draftKeyOf(resource)) || 'null');
		if (!d || typeof d !== 'object') return null;
		const edits = d.edits && typeof d.edits === 'object' ? d.edits : {};
		const newRows = Array.isArray(d.newRows) ? d.newRows : [];
		const count = Object.keys(edits).length + newRows.length;
		return count ? { edits, newRows, base: d.base && typeof d.base === 'object' ? d.base : {}, count } : null;
	} catch {
		return null;
	}
}
function writeDraft(resource, edits, newRows, baselineOf) {
	try {
		const key = draftKeyOf(resource);
		if (!Object.keys(edits).length && !newRows.length) return window.sessionStorage.removeItem(key);
		const base = {};
		Object.keys(edits).forEach((id) => {
			const row = baselineOf(id) || {};
			base[id] = Object.fromEntries(Object.keys(edits[id]).map((f) => [f, toText(row[f])]));
		});
		window.sessionStorage.setItem(key, JSON.stringify({ edits, newRows, base }));
	} catch {
		/* a full or blocked store only means there is no draft to restore */
	}
}
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

const isFormatOp = (op) => op.type === 'format';
/** Formatting entries (colour, bold...) stay in the history through saves and discards: those only concern record values. */
const keepFormatOps = (list) => list.filter(isFormatOp);

/** Applies (or reverts) one history entry to the state. */
function applyOp(state, op, direction) {
	const forward = direction === 'redo';
	switch (op.type) {
		case 'cells': {
			let { edits, newRows } = state;
			for (const c of op.changes) {
				const value = forward ? c.after : c.before;
				if (isNewKey(c.key)) {
					if (newRows.some((r) => r.key === c.key)) newRows = newRows.map((r) => (r.key === c.key ? { ...r, values: { ...r.values, [c.field]: value ?? '' } } : r));
					else newRows = [...newRows, { key: c.key, values: { [c.field]: value ?? '' } }]; // first value typed into a blank row
				}
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
		default: // 'format' entries change device-local formatting, applied by the caller, not record values
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
			return { ...state, edits, newRows: state.newRows.filter((r) => !created.has(r.key)), errors: a.errors, undo: keepFormatOps(state.undo), redo: [] };
		}
		case 'drop-edits': {
			const edits = { ...state.edits };
			a.ids.forEach((id) => delete edits[id]);
			return { ...state, edits, undo: keepFormatOps(state.undo), redo: [] };
		}
		case 'restore': {
			const top = a.newRows.reduce((m, r) => Math.max(m, Number(String(r.key).slice(2)) || 0), 0);
			return { ...state, edits: a.edits, newRows: a.newRows, counter: Math.max(state.counter, top), errors: {} };
		}
		case 'discard':
			return { ...initial, counter: state.counter, undo: keepFormatOps(state.undo) };
		default:
			return state;
	}
}

/**
 * State and persistence for the spreadsheet editor, on top of the existing record API
 * (resourceService list/create/update/remove). Edits are tracked per cell and only changed
 * fields are sent. Nothing is reported as saved until the backend confirms it.
 */
export default function useSheetData({ resource, template, canWrite, search = '', page = 1, pageSize = SHEET_PAGE_SIZE, applyFormat, autosave = false }) {
	// Extra columns: definitions come from one cached request; their values ride along with the list (extra=1), so no request per row.
	const custom = useCustomFields(resource);
	const params = useMemo(() => ({ page, pageSize, ...(search ? { q: search } : {}), ...(custom.enabled ? { extra: 1 } : {}) }), [page, pageSize, search, custom.enabled]);
	const res = useApiResource((signal) => resourceService.list(resource, params, { signal }), `sheet|${resource}|${JSON.stringify(params)}`, { enabled: Boolean(template), isEmpty: () => false });
	const rows = useMemo(() => withCustomValues(res.data || [], custom.fields), [res.data, custom.fields]);
	const [state, dispatch] = useReducer(reducer, initial);
	const [saveState, setSaveState] = useState({ status: 'idle', at: null, summary: null });
	const saving = useRef(false);

	// Baseline = the server values as last loaded (page-independent, so edits survive paging).
	const baseline = useRef(new Map());
	rows.forEach((r) => baseline.current.set(String(r.ROWID), r));

	const { can } = useAuth();
	const canAddColumns = can('custom_fields.create');
	const columns = useMemo(() => {
		const real = [...buildColumns(template, rows), ...customColumns(custom.fields)];
		// Blank columns up to AC. Only offered where extra columns can be read at all; locked unless the user may add columns.
		const blanks = custom.enabled ? Array.from({ length: Math.max(0, SHEET_COLUMNS - real.length) }, (_, i) => ({ field: `p:${i}`, label: '', type: 'str', maxLength: 500, required: false, fk: false, immutable: false, placeholder: true, locked: !canAddColumns })) : [];
		return [...real, ...blanks];
	}, [template, rows, custom.fields, custom.enabled, canAddColumns]);
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
	 * Typing into a blank column creates it (named "Column D" after its letter, text type) and then enters the value.
	 * The values wait here until the new column is in the grid.
	 */
	const waiting = useRef([]);
	const addDefinition = useCallback(
		async (label) => {
			const taken = custom.fields.map((f) => f.field_key);
			const key = keyFromLabel(label, taken);
			await customFieldsService.create({ module: resource, field_key: key, label, field_type: 'text', sort_order: custom.fields.length + 1, is_active: true });
			return key;
		},
		[custom.fields, resource]
	);
	const [columnNotice, setColumnNotice] = useState('');
	const createColumnsFrom = useCallback(
		async (items) => {
			const byField = new Map();
			items.forEach((it) => byField.set(it.field, [...(byField.get(it.field) || []), it]));
			try {
				for (const [field, list] of byField) {
					const index = columns.findIndex((c) => c.field === field);
					const key = await addDefinition(`Column ${columnLetter(index)}`);
					waiting.current.push(list.map((it) => ({ key: it.key, field: `x:${key}`, text: it.text })));
				}
				custom.reload();
			} catch (e) {
				setColumnNotice(e.message || 'Could not add the column');
			}
		},
		[addDefinition, columns, custom]
	);
	/** Header rename: names a blank column (creating it) or renames an extra column. */
	const renameColumn = useCallback(
		async (col, label) => {
			const name = String(label || '').trim();
			if (!name || name === col.label) return;
			try {
				if (col.placeholder) await addDefinition(name);
				else if (col.custom) await customFieldsService.update(col.defId, { label: name });
				custom.reload();
			} catch (e) {
				setColumnNotice(e.fieldErrors ? Object.values(e.fieldErrors)[0] : e.message || 'Could not rename the column');
			}
		},
		[addDefinition, custom]
	);

	/**
	 * Applies typed/pasted cell changes: [{ key, field, text }]. Returns { applied, rejected } where
	 * rejected = [{ key, field, reason }]; rejected cells are left untouched.
	 */
	const setCells = useCallback(
		(changes) => {
			const done = [];
			const rejected = [];
			const toCreate = [];
			for (const { key, field, text } of changes) {
				const col = colByField[field];
				if (!col) continue;
				if (col.placeholder) {
					if (String(text ?? '').trim() === '') continue;
					if (!canAddColumns) rejected.push({ key, field, reason: 'Only administrators can add columns' });
					else toCreate.push({ key, field, text });
					continue;
				}
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
				if (n.value === '' && base !== '' && !col.custom) {
					rejected.push({ key, field, reason: `${col.label}: a saved value cannot be cleared (the API only accepts new values)` });
					continue;
				}
				const current = state.edits[id] && field in state.edits[id] ? state.edits[id][field] : undefined;
				const after = n.value === base ? undefined : n.value;
				if (current !== after) done.push({ key, field, before: current, after });
			}
			if (done.length) dispatch({ type: 'op', op: { type: 'cells', changes: done } });
			if (toCreate.length) createColumnsFrom(toCreate);
			return { applied: done.length + toCreate.length, rejected };
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[colByField, baseText, state.edits, state.newRows, canAddColumns]
	);

	// Values typed into a blank column are entered once the new column has arrived.
	const setCellsRef = useRef(null);
	setCellsRef.current = setCells;
	useEffect(() => {
		if (!waiting.current.length) return;
		const ready = waiting.current.filter((list) => colByField[list[0].field]);
		if (!ready.length) return;
		waiting.current = waiting.current.filter((list) => !colByField[list[0].field]);
		setCellsRef.current(ready.flat());
	}, [colByField]);

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

/** Save every pending change. `overwrite` skips the "changed on the server" check. `auto` (autosave) writes only edits to existing records that have no problem flagged; new rows always wait for Save. */
	const save = useCallback(
	async ({ overwrite = false, auto = false } = {}) => {
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
for (const r of auto ? [] : filledNew) {
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
const ids = Object.keys(state.edits).filter((id) => !auto || !Object.keys(state.errors[rowKeyOf(id)] || {}).length);
const current = new Map();
				if (ids.length) {
					for (const part of chunk(ids, 100)) {
						const out = await resourceService.list(resource, { ids: part.join(','), pageSize: 100, ...(custom.enabled ? { extra: 1 } : {}) }, { fresh: true });
						withCustomValues(out.data, custom.fields).forEach((r) => current.set(String(r.ROWID), r));
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
							const { plain, extra } = splitCustom(Object.fromEntries(Object.entries(r.values).filter(([, v]) => v !== '')));
							await resourceService.create(resource, Object.keys(extra).length ? { ...plain, more_details: extra } : plain);
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
							// Extra values are merged into the row's current more_details (from the fresh read above) so other keys are kept.
							const { plain, extra } = splitCustom(state.edits[id]);
							const body = { ...plain };
							if (Object.keys(extra).length) {
								const merged = { ...parseExtra(current.get(id)) };
								for (const [k, v] of Object.entries(extra)) {
									if (v === '') delete merged[k];
									else merged[k] = v;
								}
								body.more_details = merged;
							}
							await resourceService.update(resource, id, body);
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
		[canWrite, columns, state.edits, state.newRows, resource, baseText, res.reload, custom.enabled, custom.fields]
	);

	// Autosave (opt-in): a few seconds after the last keystroke, edits to existing records are saved in one batch.
	// It stops at anything that needs a person: a flagged conflict or error, or a failed attempt (Save retries).
	const saveRef = useRef(save);
	saveRef.current = save;
	useEffect(() => {
		if (!autosave || !canWrite || saveState.status === 'saving' || saveState.status === 'error') return undefined;
		const eligible = Object.keys(state.edits).some((id) => !Object.keys(state.errors[rowKeyOf(id)] || {}).length);
		if (!eligible) return undefined;
		const t = setTimeout(() => saveRef.current({ auto: true }), AUTOSAVE_MS);
		return () => clearTimeout(t);
	}, [autosave, canWrite, state.edits, state.errors, saveState.status]);

	// Unsaved edits are kept as a draft for this tab; a draft found on load waits for a decision and is never overwritten.
	const [draft, setDraft] = useState(() => readDraft(resource));
	useEffect(() => {
		setDraft(readDraft(resource));
	}, [resource]);
	useEffect(() => {
		if (draft) return undefined;
		const t = setTimeout(() => writeDraft(resource, state.edits, state.newRows.filter((r) => !isBlankNew(r)), (id) => baseline.current.get(id)), 400);
		return () => clearTimeout(t);
	}, [draft, resource, state.edits, state.newRows, isBlankNew]);
	const restoreDraft = useCallback(() => {
		if (!draft) return;
		Object.entries(draft.base).forEach(([id, vals]) => {
			if (!baseline.current.has(id)) baseline.current.set(id, vals); // a record on another page: what it held when it was edited
		});
		dispatch({ type: 'restore', edits: draft.edits, newRows: draft.newRows });
		setDraft(null);
	}, [draft]);
	const dropDraft = useCallback(() => {
		try {
			window.sessionStorage.removeItem(draftKeyOf(resource));
		} catch {
			/* nothing to remove */
		}
		setDraft(null);
	}, [resource]);

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
		customFields: custom,
		renameColumn,
		canAddColumns,
		columnNotice,
		clearColumnNotice: () => setColumnNotice(''),
		state,
		valueOf,
		baseText,
		setCells,
		addRows,
		removeNewRows,
		// One history for values and formatting: a formatting entry is reverted/re-applied through `applyFormat`.
		undo: () => {
			const op = state.undo[state.undo.length - 1];
			if (op && isFormatOp(op) && applyFormat) applyFormat(op.cells, 'undo');
			dispatch({ type: 'undo' });
		},
		redo: () => {
			const op = state.redo[state.redo.length - 1];
			if (op && isFormatOp(op) && applyFormat) applyFormat(op.cells, 'redo');
			dispatch({ type: 'redo' });
		},
		recordFormat: (cells) => dispatch({ type: 'op', op: { type: 'format', cells } }),
		canUndo: state.undo.length > 0,
		canRedo: state.redo.length > 0,
		discard: () => {
			dispatch({ type: 'discard' });
			setSaveState({ status: 'idle', at: null, summary: null });
		},
		save,
		saveState,
		draft,
		restoreDraft,
		dropDraft,
		deleteRecords,
		dirtyCount,
		hasConflicts: Object.values(state.errors).some((e) => Object.values(e).some((m) => String(m).startsWith('Changed on the server'))),
	};
}
