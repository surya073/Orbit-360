import { LOOKUPS } from '../../hooks/useLookup';
import { safeCell } from '../../utils/columnConfig';
import { toCsv } from '../../utils/csv';
import { humanize } from '../../utils/format';

/**
 * Pure helpers behind the spreadsheet editor: column definitions from the backend field contract,
 * cell normalisation/validation (client-side convenience; the server stays authoritative),
 * clipboard text, sorting, filtering and export. No React, no network.
 */

// Fields that are not editable as a plain cell (structured JSON) or are import-only.
const SKIPPED_FIELDS = new Set(['more_details', 'source_record_id']);
const LABELS = { email_normalized: 'Email', work_description: 'Description', is_billable: 'Billable', late_status: 'Late status', item_priority: 'Priority' };

export const MODULE_ROUTE_KEYS = { id: 'ROWID' };

/** Column letter like a spreadsheet: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index) {
	let n = index;
	let s = '';
	do {
		s = String.fromCharCode(65 + (n % 26)) + s;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return s;
}

/**
 * Columns = the module's writable fields (from GET /imports/templates) that the list endpoint also
 * returns, so every visible cell reflects real stored data. When no rows are loaded yet every
 * writable field is offered.
 */
export function buildColumns(template, rows) {
	if (!template) return [];
	const sample = rows && rows.length ? rows[0] : null;
	return template.columns
		.filter((c) => !SKIPPED_FIELDS.has(c.field) && c.type !== 'json' && (!sample || c.field in sample))
		.map((c) => ({
			field: c.field,
			label: LABELS[c.field] || humanize(c.field),
			type: c.type,
			required: c.required,
			values: c.values,
			maxLength: c.maxLength,
			fk: Boolean(LOOKUPS[c.field]),
			immutable: template.immutable.includes(c.field),
		}));
}

// ---- custom columns: definitions from /custom-fields, values stored in each record's more_details ----
export const CUSTOM_PREFIX = 'x:';
export const isCustomField = (field) => typeof field === 'string' && field.startsWith(CUSTOM_PREFIX);
const CUSTOM_TYPES = { text: 'str', number: 'num', date: 'date', choice: 'enum' };

/** Grid columns for the extra fields of a record type (appended after the built-in columns). */
export function customColumns(defs) {
	return (defs || []).map((d) => ({
		field: CUSTOM_PREFIX + d.field_key,
		label: d.label,
		type: CUSTOM_TYPES[d.field_type] || 'str',
		required: false,
		values: d.field_type === 'choice' ? String(d.choices || '').split(',').map((c) => c.trim()).filter(Boolean) : undefined,
		maxLength: d.field_type === 'text' ? 500 : undefined,
		fk: false,
		immutable: false,
		custom: true,
		defId: d.ROWID,
		order: Number(d.sort_order) || 0,
	}));
}

export function parseExtra(row) {
	if (!row || !row.more_details) return {};
	try {
		const o = typeof row.more_details === 'string' ? JSON.parse(row.more_details) : row.more_details;
		return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
	} catch {
		return {};
	}
}

/** Rows with each defined extra value exposed as a plain x:key field, so the grid treats it like any column. */
export function withCustomValues(rows, defs) {
	if (!defs || defs.length === 0) return rows;
	return rows.map((r) => {
		const extra = parseExtra(r);
		const out = { ...r };
		for (const d of defs) if (extra[d.field_key] !== undefined && extra[d.field_key] !== null) out[CUSTOM_PREFIX + d.field_key] = extra[d.field_key];
		return out;
	});
}

/** Splits a row's changed values into built-in fields and the extra (more_details) ones, keyed without the prefix. */
export function splitCustom(values) {
	const plain = {};
	const extra = {};
	for (const [k, v] of Object.entries(values)) {
		if (isCustomField(k)) extra[k.slice(CUSTOM_PREFIX.length)] = v;
		else plain[k] = v;
	}
	return { plain, extra };
}

/** URL-safe key for a new column from its label: "Client tier" -> client_tier (unique among the keys already taken). */
export function keyFromLabel(label, taken = []) {
	const base = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '').slice(0, 36) || 'field';
	let key = base.length < 2 ? base + '_x' : base;
	for (let i = 2; taken.includes(key); i++) key = base.slice(0, 36 - String(i).length - 1) + '_' + i;
	return key;
}

/** Stored value -> the text shown/edited in a cell. */
export function toText(v) {
	if (v === null || v === undefined) return '';
	if (v === true) return 'true';
	if (v === false) return 'false';
	return String(v);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ID_RE = /^\d{1,20}$/;

function validDate(s) {
	if (!DATE_RE.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Normalises typed/pasted text for a column. Returns { value } (canonical text, '' for blank) or
 * { error }. Enum values accept the label ("On leave"); booleans accept yes/no/true/false/1/0.
 */
export function normalizeCell(col, raw) {
	const text = String(raw ?? '').trim();
	if (text === '') return { value: '' };
	switch (col.type) {
		case 'enum': {
			const key = text.toLowerCase().replace(/\s+/g, '_');
			const hit = col.values.find((v) => v === key) || col.values.find((v) => v.toLowerCase() === text.toLowerCase());
			return hit ? { value: hit } : { error: `Must be one of: ${col.values.join(', ')}` };
		}
		case 'bool': {
			const k = text.toLowerCase();
			if (['true', 'yes', 'y', '1'].includes(k)) return { value: 'true' };
			if (['false', 'no', 'n', '0'].includes(k)) return { value: 'false' };
			return { error: 'Must be Yes or No' };
		}
		case 'int':
		case 'num': {
			const n = Number(text);
			if (!Number.isFinite(n)) return { error: 'Must be a number' };
			if (col.type === 'int' && !Number.isInteger(n)) return { error: 'Must be a whole number' };
			return { value: String(n) };
		}
		case 'date':
			return validDate(text) ? { value: text } : { error: 'Use YYYY-MM-DD' };
		case 'datetime':
			return DATETIME_RE.test(text) ? { value: text } : { error: 'Use YYYY-MM-DD HH:mm:ss' };
		case 'id':
			return ID_RE.test(text) ? { value: text } : { error: 'Must be a numeric record id (use the picker)' };
		default:
			return col.maxLength && text.length > col.maxLength ? { error: `At most ${col.maxLength} characters` } : { value: text };
	}
}

/** Display text for a cell (labels for foreign keys / enums / booleans). */
export function displayText(col, value, labelOf) {
	const t = toText(value);
	if (t === '') return '';
	if (col.fk && labelOf) return labelOf(col.field, t) || t;
	if (col.type === 'bool') return t === 'true' ? 'Yes' : 'No';
	if (col.type === 'enum') return humanize(t);
	return t;
}

// ---- clipboard ------------------------------------------------------------------------------

/** Rows x cols of text -> tab-separated text (cells with tabs/newlines are quoted). */
export function toTsv(matrix) {
	return matrix.map((row) => row.map((c) => (/[\t\n\r"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join('\t')).join('\n');
}

/** Tab-separated clipboard text -> matrix. Plain text only; quotes are honoured (Excel/Sheets style). */
export function parseTsv(text) {
	const src = String(text).replace(/\r\n?/g, '\n');
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (quoted) {
			if (c === '"' && src[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"' && field === '') quoted = true;
		else if (c === '\t') {
			row.push(field);
			field = '';
		} else if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// ---- sort / filter / search -----------------------------------------------------------------

export function compareValues(col, a, b) {
	const x = toText(a);
	const y = toText(b);
	if (x === '' && y === '') return 0;
	if (x === '') return 1; // blanks last in both directions handled by caller
	if (y === '') return -1;
	if (col.type === 'int' || col.type === 'num' || col.type === 'id') return Number(x) - Number(y);
	return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
}

/** Stable client-side sort of the loaded rows. `getValue(row, field)` supplies the (edited) value. */
export function sortRows(rows, col, dir, getValue) {
	if (!col || !dir) return rows;
	const sign = dir === 'desc' ? -1 : 1;
	return rows
		.map((r, i) => [r, i])
		.sort((p, q) => {
			const a = toText(getValue(p[0], col.field));
			const b = toText(getValue(q[0], col.field));
			if (a === '' || b === '') return a === b ? p[1] - q[1] : a === '' ? 1 : -1; // blanks always last
			return sign * compareValues(col, a, b) || p[1] - q[1];
		})
		.map((p) => p[0]);
}

export const FILTER_OPS = { contains: 'contains', equals: 'is' };

export function matchesFilter(col, filter, value, labelOf) {
	const shown = displayText(col, value, labelOf).toLowerCase();
	const needle = String(filter.value).toLowerCase();
	if (filter.op === 'equals') return toText(value).toLowerCase() === needle || shown === needle;
	return shown.includes(needle) || toText(value).toLowerCase().includes(needle);
}

// ---- export ---------------------------------------------------------------------------------

/**
 * CSV of the given rows, one column per entry of `columns` in that order. Headers are the real field names (importable by
 * Sheet Import) unless `headers: 'labels'` asks for each column's `exportLabel`. Cells that a spreadsheet program would run
 * as a formula are written as plain text (see utils/columnConfig safeCell).
 */
export function rowsToCsv(columns, rows, getValue, { headers = 'fields' } = {}) {
	const head = columns.map((c) => safeCell(headers === 'labels' ? c.exportLabel || c.label : c.field));
	return toCsv([head, ...rows.map((r) => columns.map((c) => safeCell(toText(getValue(r, c.field)))))]);
}

// ---- navigation helpers ----------------------------------------------------------------------

/**
 * Where Ctrl+Arrow lands, like a spreadsheet: from a cell with data whose neighbour also has data,
 * the last cell of that run; otherwise the next cell with data in that direction; otherwise the edge.
 * `filled(r, c)` says whether a cell holds a value. Stable for any shape: it only walks one line.
 */
export function jumpTarget(filled, r, c, dr, dc, rowCount, colCount) {
	const inside = (a, b) => a >= 0 && b >= 0 && a < rowCount && b < colCount;
	let nr = r + dr;
	let nc = c + dc;
	if (!inside(nr, nc)) return [r, c];
	if (filled(r, c) && filled(nr, nc)) {
		while (inside(nr + dr, nc + dc) && filled(nr + dr, nc + dc)) {
			nr += dr;
			nc += dc;
		}
		return [nr, nc];
	}
	while (inside(nr, nc) && !filled(nr, nc)) {
		nr += dr;
		nc += dc;
	}
	if (inside(nr, nc)) return [nr, nc];
	return [dr > 0 ? rowCount - 1 : dr < 0 ? 0 : r, dc > 0 ? colCount - 1 : dc < 0 ? 0 : c];
}

/** "B3" / "B3:D9" label for a selection, like a spreadsheet's name box. */
export function rangeLabel(sel) {
	const a = `${columnLetter(Math.min(sel.c0, sel.c1))}${Math.min(sel.r0, sel.r1) + 1}`;
	const b = `${columnLetter(Math.max(sel.c0, sel.c1))}${Math.max(sel.r0, sel.r1) + 1}`;
	return a === b ? a : `${a}:${b}`;
}
