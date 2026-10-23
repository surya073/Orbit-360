/**
 * Turns the rows of an uploaded file into records the server accepts, without losing anything the user uploaded:
 *   - dates in the usual spreadsheet styles (05-01-2026, 5 Jan 2026, 4 August 2025, 2026/1/5) become YYYY-MM-DD;
 *   - values are tidied to the field's type (case of allowed values, yes/no, thousands separators);
 *   - spreadsheet error cells (#REF!, #N/A ...) are treated as blank;
 *   - every column that does not match a field is kept in `more_details` as { "column name": "value" }, so a file in
 *     any layout can be imported and nothing is thrown away.
 * Pure functions, no I/O. The server still validates every value.
 */

/** The target a column is mapped to when it has no field of its own: the row's `more_details`. */
export const EXTRA = 'more_details';

const ERROR_CELL = /^#(REF|N\/A|VALUE|DIV\/0|NAME|NULL|NUM)[!?]?$/i;
const EMOJI_RE = /[\u{10000}-\u{10FFFF}]/gu;
export const DETAILS_MAX = 4000; // serialized size kept per row (the server allows more; this keeps rows light)
const VALUE_MAX = 400;
const KEY_MAX = 60;

export const isErrorCell = (v) => ERROR_CELL.test(String(v ?? '').trim());

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

function validDate(y, m, d) {
	if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
	const t = new Date(Date.UTC(y, m - 1, d));
	return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/**
 * A date as YYYY-MM-DD, or null when it cannot be read. Numeric dates are day-first (05-01-2026 is 5 January) unless a
 * part larger than 12 says otherwise, which matches how the company writes dates; month names are never ambiguous.
 */
export function normalizeDate(raw) {
	const s = String(raw ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
	if (!s) return null;
	let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s);
	if (m) return validDate(+m[1], +m[2], +m[3]);
	m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/.exec(s);
	if (m) {
		const a = +m[1];
		const b = +m[2];
		const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
		if (b > 12 && a <= 12) return validDate(y, a, b); // 01-25-2026: month first
		return validDate(y, b, a); // day first
	}
	m = /^(\d{1,2})[ ./-]([A-Za-z]{3,9})\.?,?[ ./-](\d{2}|\d{4})$/.exec(s);
	if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
	m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(s);
	if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return validDate(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
	// only a month and a year ("Feb 2024", "February 2024"): the first of that month
	m = /^([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(s);
	if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return validDate(+m[2], MONTHS[m[1].slice(0, 3).toLowerCase()], 1);
	return null;
}

/** True when a value looks like a date in any of the styles above (used by the column matcher). */
export const looksLikeDate = (v) => normalizeDate(v) !== null;

const keyOf = (s) => String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');

/** One cell tidied for a field of this type; an unreadable value is returned as typed so the server can explain it. */
export function normalizeValue(column, raw) {
	let v = String(raw ?? '').replace(/ /g, ' ').replace(EMOJI_RE, '').trim();
	if (v === '' || isErrorCell(v)) return '';
	if (!column) return v;
	switch (column.type) {
		case 'date': {
			const d = normalizeDate(v);
			return d || v;
		}
		case 'datetime': {
			const d = normalizeDate(v.split(' ')[0]);
			return d && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? v : d ? `${d} 00:00:00` : v;
		}
		case 'enum': {
			const want = keyOf(v);
			const hit = (column.values || []).find((x) => keyOf(x) === want);
			return hit || v;
		}
		case 'bool': {
			if (/^(true|yes|y|1)$/i.test(v)) return 'true';
			if (/^(false|no|n|0)$/i.test(v)) return 'false';
			return v;
		}
		case 'int':
		case 'num': {
			const plain = v.replace(/,/g, '').replace(/%$/, '').trim();
			return /^-?\d+(\.\d+)?$/.test(plain) ? plain : v;
		}
		default:
			return v;
	}
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A free-text `more_details` cell: JSON is kept as it is; "Key: value; Key: value" becomes an object; anything else is kept
 * as a note. Returns an object (never throws).
 */
export function parseLooseDetails(text) {
	const t = String(text ?? '').trim();
	if (!t) return {};
	if (t.startsWith('{')) {
		try {
			const o = JSON.parse(t);
			if (o && typeof o === 'object' && !Array.isArray(o)) return o;
		} catch {
			/* not JSON: read it as text below */
		}
	}
	const parts = t.split(/;\s*/).map((p) => p.trim()).filter(Boolean);
	const pairs = parts.map((p) => /^([^:]{1,60}):\s*(.*)$/.exec(p));
	if (parts.length && pairs.every(Boolean)) {
		const out = {};
		pairs.forEach((m) => {
			out[m[1].trim()] = m[2].trim();
		});
		return out;
	}
	return { notes: t };
}

/** Adds a value under `key`, keeping earlier values when the same header appears twice ("Status", "Status (2)"). */
function put(out, key, value) {
	let k = clip(String(key).trim() || 'Column', KEY_MAX);
	let n = 2;
	while (k in out) k = `${clip(String(key).trim() || 'Column', KEY_MAX - 5)} (${n++})`;
	out[k] = value;
}

/**
 * The `more_details` object for one row. `columns` = [{ header, index }] of every column mapped to more_details; a column
 * literally called more_details is read as JSON / "Key: value" text and merged in, the rest are stored under their header.
 */
export function detailsForRow(row, columns) {
	const out = {};
	let cut = false;
	for (const { header, index } of columns) {
		const raw = String(row[index] ?? '').replace(/ /g, ' ').replace(EMOJI_RE, '').trim();
		if (!raw || isErrorCell(raw)) continue;
		if (keyOf(header) === EXTRA) {
			for (const [k, v] of Object.entries(parseLooseDetails(raw))) {
				const val = typeof v === 'string' ? v : JSON.stringify(v);
				if (String(val).trim() !== '' && !isErrorCell(val)) put(out, k, clip(String(val).trim(), VALUE_MAX));
			}
		} else {
			if (raw.length > VALUE_MAX) cut = true;
			put(out, header, clip(raw.replace(/\s+/g, ' '), VALUE_MAX));
		}
	}
	// keep the serialized size under the cap by dropping the last keys (reported, never silent)
	let json = JSON.stringify(out);
	const keys = Object.keys(out);
	while (json.length > DETAILS_MAX && keys.length) {
		delete out[keys.pop()];
		cut = true;
		json = JSON.stringify(out);
	}
	return { object: out, json: keys.length ? json : '', cut };
}

/**
 * Records for the server from data rows through a header -> field mapping. `mapping[i]` is a field name, EXTRA, or null
 * (left out). `template` supplies each field's type so values can be tidied; blank cells are omitted, never turned into
 * 0 or ''. Returns { records, trimmed } where trimmed counts rows whose extra details had to be shortened.
 */
export function buildRecords(cells, mapping, headers, template) {
	const byField = new Map((template ? template.columns : []).map((c) => [c.field, c]));
	const extras = mapping.map((m, i) => (m === EXTRA ? { header: headers[i] || `Column ${i + 1}`, index: i } : null)).filter(Boolean);
	let trimmed = 0;
	const records = cells.map((row) => {
		const rec = {};
		mapping.forEach((field, i) => {
			if (!field || field === EXTRA) return;
			const v = normalizeValue(byField.get(field), row[i]);
			if (v !== '') rec[field] = v;
		});
		if (extras.length) {
			const d = detailsForRow(row, extras);
			if (d.json) rec[EXTRA] = d.json;
			if (d.cut) trimmed += 1;
		}
		return rec;
	});
	return { records, trimmed };
}

/** Header positions that hold no data at all (a stray empty column): not worth keeping in more_details. */
export const emptyColumns = (headers, cells) => headers.map((_, i) => cells.every((r) => String(r[i] ?? '').trim() === '' || isErrorCell(r[i])));
