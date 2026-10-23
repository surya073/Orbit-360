// Minimal RFC 4180 CSV parser/serializer (quoted fields, escaped quotes, CRLF, BOM).
export function parseCsv(text) {
	const src = text.replace(/^﻿/, '');
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (inQuotes) {
			if (c === '"' && src[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') inQuotes = false;
			else field += c;
		} else if (c === '"') inQuotes = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else field += c;
	}
	if (inQuotes) throw new Error('CSV has an unterminated quoted field');
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Parses CSV into { headers, records }. Header text is matched to field names
 * case-insensitively; blank cells are omitted (never converted to 0 or '').
 */
export function csvToRecords(text, fieldNames) {
	const rows = parseCsv(text);
	if (rows.length < 2) throw new Error('The file needs a header row and at least one data row');
	const headers = rows[0].map((h) => h.trim());
	const byLower = new Map(fieldNames.map((n) => [n.toLowerCase(), n]));
	const mapping = headers.map((h) => byLower.get(h.toLowerCase().replace(/\s+/g, '_')) || null);
	const unmapped = headers.filter((_, i) => !mapping[i]);
	const records = rows.slice(1).map((cells) => {
		const rec = {};
		mapping.forEach((field, i) => {
			const v = (cells[i] ?? '').trim();
			if (field && v !== '') rec[field] = v;
		});
		return rec;
	});
	return { headers, mapping, unmapped, records };
}

const esc = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows) => rows.map((r) => r.map((c) => esc(String(c ?? ''))).join(',')).join('\r\n');

// ---- column mapping (import) -------------------------------------------------------------------

const normHeader = (h) => String(h).trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Raw CSV as { headers, cells } (cells = the data rows as arrays), without matching anything to fields. */
export function readCsv(text) {
	const rows = parseCsv(text);
	if (rows.length < 2) throw new Error('The file needs a header row and at least one data row');
	const headers = rows[0].map((h) => h.trim());
	const cells = rows.slice(1);
	// A row with more or fewer values than the header usually has a missing or extra comma, which shifts every value after it.
	const ragged = cells.map((r, i) => ({ rowNumber: i + 1, got: r.length })).filter((r) => r.got !== headers.length);
	return { headers, cells, ragged, expected: headers.length };
}

/**
 * Guesses which field each header is meant for (case, spaces and dashes ignored). A field is claimed by the first header
 * that names it; a repeated header is left unmapped so it has to be decided by the user instead of silently overwriting.
 */
export function autoMapHeaders(headers, fieldNames) {
	const byNorm = new Map(fieldNames.map((n) => [normHeader(n), n]));
	const used = new Set();
	return headers.map((h) => {
		const field = byNorm.get(normHeader(h)) || null;
		if (!field || used.has(field)) return null;
		used.add(field);
		return field;
	});
}

/** Fields that more than one header is mapped to (the file could not be read unambiguously). */
export const duplicateTargets = (mapping) => [...new Set(mapping.filter((f, i) => f && f !== 'more_details' && mapping.indexOf(f) !== i))]; // any number of columns can go to more_details

/** Records from the data rows through a header -> field mapping; blank cells are omitted, never turned into 0 or ''. */
export function recordsFromMapping(cells, mapping) {
	return cells.map((row) => {
		const rec = {};
		mapping.forEach((field, i) => {
			const v = (row[i] ?? '').trim();
			if (field && v !== '') rec[field] = v;
		});
		return rec;
	});
}
