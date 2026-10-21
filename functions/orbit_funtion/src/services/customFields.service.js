'use strict';

const { errors } = require('../utils/errors');
const { isValidDate } = require('../utils/dateUtils');

const TTL_MS = 10 * 60 * 1000;
const VALUES_MAX = 2000; // serialized size of the custom values in one row
const EMOJI_RE = /[\u{10000}-\u{10FFFF}]/gu;

let cache = null; // { at, byModule: Map(module -> Map(key -> def)) } per function instance

const invalidate = () => {
	cache = null;
};

/** Active definitions grouped by module. One Data Store request per instance every TTL_MS, only when a row with extra values is written. */
async function definitions(ctx) {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.byModule;
	const rows = await ctx.db.select('SELECT ROWID, module, field_key, field_type, choices FROM custom_fields WHERE is_deleted = false AND is_active = true LIMIT 0, 300', 'custom_fields', ['is_active']);
	const byModule = new Map();
	for (const r of rows) {
		if (!byModule.has(r.module)) byModule.set(r.module, new Map());
		byModule.get(r.module).set(r.field_key, { type: r.field_type, choices: String(r.choices || '').split(',').map((c) => c.trim()).filter(Boolean) });
	}
	cache = { at: Date.now(), byModule };
	return byModule;
}

function checkValue(def, raw) {
	if (raw === null || raw === '') return { value: null };
	switch (def.type) {
		case 'number': {
			const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
			return Number.isFinite(n) ? { value: n } : { error: 'Must be a number' };
		}
		case 'date':
			return isValidDate(raw) ? { value: raw } : { error: 'Must be a valid YYYY-MM-DD date' };
		case 'choice':
			return typeof raw === 'string' && def.choices.includes(raw.trim()) ? { value: raw.trim() } : { error: `Must be one of: ${def.choices.join(', ')}` };
		default:
			return typeof raw === 'string' && raw.replace(EMOJI_RE, '').trim().length <= 500 ? { value: raw.replace(EMOJI_RE, '').trim() } : { error: 'Must be text of at most 500 characters' };
	}
}

/**
 * Checks the `more_details` JSON of a create/update. Keys defined for the module are type-checked; any other key is
 * refused unless the stored row already holds it with the same value (so imported or older keys survive an edit).
 * Returns the serialized JSON to store.
 */
async function checkMoreDetails(ctx, moduleName, serialized, existingSerialized) {
	let incoming;
	try {
		incoming = JSON.parse(serialized);
	} catch {
		throw errors.validation([{ field: 'more_details', code: 'INVALID_JSON', message: 'Must be a valid JSON object' }]);
	}
	let existing = {};
	try {
		existing = existingSerialized ? JSON.parse(existingSerialized) : {};
	} catch {
		existing = {};
	}
	const defs = (await definitions(ctx)).get(moduleName) || new Map();
	const problems = [];
	const out = {};
	const custom = {};
	for (const [key, raw] of Object.entries(incoming)) {
		const def = defs.get(key);
		if (def) {
			const r = checkValue(def, raw);
			if (r.error) problems.push({ field: `more_details.${key}`, code: 'INVALID_VALUE', message: r.error });
			else if (r.value !== null) custom[key] = r.value;
		} else if (JSON.stringify(existing[key]) === JSON.stringify(raw) && key in existing) {
			out[key] = raw;
		} else {
			problems.push({ field: `more_details.${key}`, code: 'UNKNOWN_CUSTOM_FIELD', message: 'No such custom column' });
		}
	}
	if (JSON.stringify(custom).length > VALUES_MAX) problems.push({ field: 'more_details', code: 'TOO_LONG', message: `Extra column values must be at most ${VALUES_MAX} characters in total` });
	if (problems.length) throw errors.validation(problems);
	return JSON.stringify({ ...out, ...custom });
}

module.exports = { checkMoreDetails, invalidate, definitions };
