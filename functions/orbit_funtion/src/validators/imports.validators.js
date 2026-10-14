'use strict';

const { errors } = require('../utils/errors');
const { f, validateRecord, isId } = require('./schema');
const { CONFLICT_POLICIES, RESOLUTIONS } = require('../config/constants');
const { environment } = require('../config/environment');
const { resources } = require('../config/resources');

/** Resources with a writable schema, except admin-only masters. */
const importableModules = () => Object.values(resources).filter((r) => r.fields && !r.adminWrite).map((r) => r.name);

const JOB_FIELDS = {
	module: f.str(40, { req: true }),
	fileName: f.str(255, { req: true }),
	fileType: f.oneOf(['csv', 'xlsx']),
	fileSha256: f.str(64),
	totalRows: f.int({ min: 1, max: 100000 }),
	conflictPolicy: f.oneOf(CONFLICT_POLICIES),
	teamId: f.id(),
};

function createJobBody(raw) {
	const { value, errors: errs } = validateRecord(JOB_FIELDS, raw);
	if (value.module && !importableModules().includes(value.module)) {
		errs.push({ field: 'module', code: 'INVALID_VALUE', message: `Must be one of: ${importableModules().join(', ')}` });
	}
	if (value.fileSha256 && !/^[a-f0-9]{64}$/i.test(value.fileSha256)) errs.push({ field: 'fileSha256', code: 'INVALID_VALUE', message: 'Must be a SHA-256 hex digest' });
	if (errs.length) throw errors.validation(errs);
	return { ...value, fileSha256: value.fileSha256 && value.fileSha256.toLowerCase(), conflictPolicy: value.conflictPolicy || 'ask' };
}

/** rows: [{ rowNumber, data }] limited to the configured batch size. */
function rowsBody(raw) {
	if (!Array.isArray(raw.rows) || raw.rows.length === 0) throw errors.badRequest('rows must be a non-empty array');
	if (raw.rows.length > environment.importBatchSize) throw errors.badRequest(`At most ${environment.importBatchSize} rows per request`);
	const seen = new Set();
	const rows = raw.rows.map((r, i) => {
		const n = r && r.rowNumber;
		if (!Number.isInteger(n) || n < 1 || n > 1000000) throw errors.badRequest(`rows[${i}].rowNumber must be a positive integer`);
		if (seen.has(n)) throw errors.badRequest(`rowNumber ${n} appears twice in this batch`);
		seen.add(n);
		if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) throw errors.badRequest(`rows[${i}].data must be an object`);
		return { rowNumber: n, data: r.data };
	});
	return { rows };
}

function resolveBody(raw) {
	if (!Array.isArray(raw.resolutions) || raw.resolutions.length === 0) throw errors.badRequest('resolutions must be a non-empty array');
	if (raw.resolutions.length > environment.importBatchSize) throw errors.badRequest(`At most ${environment.importBatchSize} resolutions per request`);
	const resolutions = raw.resolutions.map((r, i) => {
		if (!r || !Number.isInteger(r.rowNumber) || r.rowNumber < 1) throw errors.badRequest(`resolutions[${i}].rowNumber must be a positive integer`);
		if (!RESOLUTIONS.includes(r.resolution)) throw errors.badRequest(`resolutions[${i}].resolution must be one of: ${RESOLUTIONS.join(', ')}`);
		return { rowNumber: r.rowNumber, resolution: r.resolution };
	});
	return { resolutions };
}

function jobParams(raw) {
	if (!isId(String(raw.id))) throw errors.badRequest('Invalid id');
	return { ...raw, id: String(raw.id) };
}

function rowsQuery(raw) {
	const out = {};
	if (raw.status !== undefined) {
		if (!['valid', 'invalid', 'conflict', 'skipped', 'committed', 'failed'].includes(raw.status)) throw errors.badRequest('Unknown status filter');
		out.status = raw.status;
	}
	return out;
}

module.exports = { importableModules, createJobBody, rowsBody, resolveBody, jobParams, rowsQuery };
