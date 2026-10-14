'use strict';

const { isValidDate } = require('../utils/dateUtils');

const ID_RE = /^\d{1,20}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const EMOJI_RE = /[\u{10000}-\u{10FFFF}]/gu; // Data Store silently corrupts 4-byte UTF-8
const MORE_DETAILS_MAX = 9000;

const isId = (v) => typeof v === 'string' && ID_RE.test(v);
const isBlank = (v) => v === undefined || v === null || v === '';

/** Field spec helpers: f.str(255, { req: true }) etc. */
const f = {
	str: (max, o = {}) => ({ t: 'str', max, ...o }),
	text: (max = 9000, o = {}) => ({ t: 'text', max, ...o }),
	int: (o = {}) => ({ t: 'int', ...o }),
	num: (o = {}) => ({ t: 'num', ...o }),
	date: (o = {}) => ({ t: 'date', ...o }),
	datetime: (o = {}) => ({ t: 'datetime', ...o }),
	bool: (o = {}) => ({ t: 'bool', ...o }),
	id: (o = {}) => ({ t: 'id', ...o }),
	oneOf: (values, o = {}) => ({ t: 'enum', values, ...o }),
	json: (o = {}) => ({ t: 'json', ...o }),
};

function checkField(spec, raw) {
	switch (spec.t) {
		case 'str':
		case 'text': {
			if (typeof raw !== 'string') return { error: ['INVALID_TYPE', 'Must be text'] };
			const v = raw.replace(EMOJI_RE, '').trim();
			if (v.length > spec.max) return { error: ['TOO_LONG', `Must be at most ${spec.max} characters`] };
			return { value: spec.lower ? v.toLowerCase() : v };
		}
		case 'enum': {
			if (typeof raw !== 'string' || !spec.values.includes(raw.trim().toLowerCase())) {
				return { error: ['INVALID_VALUE', `Must be one of: ${spec.values.join(', ')}`] };
			}
			return { value: raw.trim().toLowerCase() };
		}
		case 'int':
		case 'num': {
			const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
			if (!Number.isFinite(n)) return { error: ['INVALID_NUMBER', 'Must be a number'] };
			if (spec.t === 'int' && !Number.isInteger(n)) return { error: ['INVALID_NUMBER', 'Must be a whole number'] };
			if (spec.min !== undefined && n < spec.min) return { error: ['OUT_OF_RANGE', `Must be >= ${spec.min}`] };
			if (spec.max !== undefined && n > spec.max) return { error: ['OUT_OF_RANGE', `Must be <= ${spec.max}`] };
			return { value: n };
		}
		case 'date':
			return isValidDate(raw) ? { value: raw } : { error: ['INVALID_DATE', 'Must be a valid YYYY-MM-DD date'] };
		case 'datetime':
			return typeof raw === 'string' && DATETIME_RE.test(raw) ? { value: raw } : { error: ['INVALID_DATETIME', 'Must be YYYY-MM-DD HH:mm:ss'] };
		case 'bool': {
			if (raw === true || raw === 'true') return { value: 'true' };
			if (raw === false || raw === 'false') return { value: 'false' };
			return { error: ['INVALID_BOOLEAN', 'Must be true or false'] };
		}
		case 'id': {
			const v = typeof raw === 'number' ? String(raw) : raw;
			return isId(v) ? { value: v } : { error: ['INVALID_ID', 'Must be a numeric row id'] };
		}
		case 'json': {
			// `more_details`: a JSON object (or its serialized form); never holds structured fields.
			let obj = raw;
			if (typeof raw === 'string') {
				try {
					obj = JSON.parse(raw);
				} catch {
					return { error: ['INVALID_JSON', 'Must be a valid JSON object'] };
				}
			}
			if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return { error: ['INVALID_JSON', 'Must be a JSON object'] };
			const s = JSON.stringify(obj).replace(EMOJI_RE, '');
			if (s.length > MORE_DETAILS_MAX) return { error: ['TOO_LONG', `Serialized size must be at most ${MORE_DETAILS_MAX} characters`] };
			return { value: s };
		}
		default:
			return { error: ['INVALID_SPEC', 'Unsupported field type'] };
	}
}

/**
 * Validates `input` against `fields`. Unknown fields are rejected (never silently dropped).
 * Missing optional values are omitted - never defaulted to 0 or ''.
 * Returns { value, errors: [{ field, code, message }] }.
 */
function validateRecord(fields, input, { partial = false } = {}) {
	const value = {};
	const errors = [];
	for (const key of Object.keys(input)) {
		if (!fields[key]) errors.push({ field: key, code: 'UNKNOWN_FIELD', message: 'Field is not accepted' });
	}
	for (const [name, spec] of Object.entries(fields)) {
		const raw = input[name];
		if (isBlank(raw)) {
			if (spec.req && !partial) errors.push({ field: name, code: 'REQUIRED', message: 'Required' });
			continue;
		}
		const r = checkField(spec, raw);
		if (r.error) errors.push({ field: name, code: r.error[0], message: r.error[1] });
		else value[name] = r.value;
	}
	return { value, errors };
}

module.exports = { f, isId, isBlank, validateRecord, ID_RE };
