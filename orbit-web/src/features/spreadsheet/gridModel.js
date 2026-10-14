import { LOOKUPS } from '../../hooks/useLookup';
import { toCsv } from '../../utils/csv';
import { humanize } from '../../utils/format';

/**
 * Pure helpers behind the spreadsheet editor: column definitions from the backend field contract,
 * cell normalisation/validation (client-side convenience; the server stays authoritative),
 * clipboard text, sorting, filtering and export. No React, no network.
 */

// Fields that are not editable as a plain cell (structured JSON) or are import-only.
const SKIPPED_FIELDS = new Set(['more_details', 'source_record_id']);
const LABELS = { email_normalized: 'Email', work_description: 'Description', is_billable: 'Billable', late_status: 'Late status' };

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
			const hit = col.values.find((v) => v === key);
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

/** CSV of the visible rows using the real field names as headers (importable by Sheet Import). */
export function rowsToCsv(columns, rows, getValue) {
	return toCsv([columns.map((c) => c.field), ...rows.map((r) => columns.map((c) => toText(getValue(r, c.field))))]);
}
