'use strict';

const crypto = require('crypto');
const { errors } = require('../utils/errors');

const SAFE_KEY_RE = /^[A-Za-z0-9 _.\-/:@|]{1,255}$/;

/** Keys are interpolated into IN (...) lookups; anything unusual is replaced by its hash (consistently). */
function safeKey(key) {
	return SAFE_KEY_RE.test(key) ? key : `h:${crypto.createHash('sha256').update(key).digest('hex')}`;
}

/** FK columns that define a row's identity/scope; they cannot be re-pointed after creation. */
function immutableFields(resource) {
	const s = new Set();
	if (resource.teamFrom) s.add(resource.teamFrom.fk);
	if (resource.scopeVia) {
		s.add(resource.scopeVia.fk);
		s.add('employee_id');
	}
	for (const c of resource.parentChecks || []) s.add(c.fk);
	return s;
}

/**
 * Stable match key used for idempotent de-duplication (imports) and conflict detection.
 * Returns { column, key } or null when the row has no stable identity.
 */
function matchKeyFor(resource, value) {
	if (resource.dedupe) {
		if (resource.sidDedupe && value.source_record_id) return { column: 'dedupe_key', key: safeKey(`src|${value.source_record_id}`) };
		if (resource.randomDedupe) return null; // needs source_record_id
		return { column: 'dedupe_key', key: safeKey(resource.dedupe(value)) };
	}
	for (const col of resource.matchColumns || []) {
		if (value[col]) return { column: col, key: String(value[col]) };
	}
	return null;
}

/** Applies server-owned columns to a validated payload. */
function prepareRow(resource, value, { source = 'manual', jobId } = {}) {
	const row = { ...value };
	// Defaults fill gaps only: an import may supply its own value (e.g. approval_status).
	for (const [k, v] of Object.entries(resource.defaults ? resource.defaults() : {})) if (row[k] === undefined) row[k] = v;
	if (resource.derive) {
		for (const [k, v] of Object.entries(resource.derive(row))) if (v !== undefined) row[k] = v;
	}
	if (resource.dedupe) {
		const m = source === 'import' ? matchKeyFor(resource, row) : { key: safeKey(resource.dedupe(row)) };
		if (m) row.dedupe_key = m.key;
	}
	if (resource.sourceSystem) row.source_system = source;
	if (resource.table !== 'teams') row.is_deleted = 'false';
	if (jobId) row.import_job_id = String(jobId);
	return row;
}

// ---- references (employee_id / project_id / team) --------------------------------------

/** Which parent tables and ids a set of payloads refers to. */
function referencedIds(resource, values) {
	const need = {};
	const add = (table, id) => {
		if (id) (need[table] ||= new Set()).add(String(id));
	};
	for (const v of values) {
		if (resource.teamFrom) add(resource.teamFrom.parent, v[resource.teamFrom.fk]);
		for (const c of resource.parentChecks || []) add(c.parent, v[c.fk]);
		if (resource.scopeVia) {
			add(resource.scopeVia.parent, v[resource.scopeVia.fk]);
			add('employees', v.employee_id);
		}
		if (resource.table === 'employees') add('employees', v.reports_to_employee_id);
	}
	return need;
}

/**
 * Loads the owning team of every referenced parent row in ONE query per parent table
 * (<= 50 ids per query) - independent of how many rows are being written.
 */
async function loadReferences(ctx, resource, values) {
	const need = referencedIds(resource, values);
	const refs = {};
	await Promise.all(Object.entries(need).map(async ([table, ids]) => (refs[table] = await ctx.repos.table(table).ownersOf([...ids]))));
	return refs;
}

const refError = (field, code, message) => errors.validation([{ field, code, message }]);

/**
 * Validates references for one row against preloaded `refs`, enforces team scope, and
 * derives team_id / team column. Throws ApiError (validation/forbidden) on the first problem.
 */
function applyReferences(scope, resource, row, refs) {
	const owner = (table, field, id) => {
		const map = refs[table];
		if (!map || !map.has(String(id))) throw refError(field, 'NOT_FOUND', 'Referenced record does not exist');
		return map.get(String(id));
	};

	if (resource.teamFrom) {
		const { fk, parent, optional } = resource.teamFrom;
		if (row[fk]) {
			const team = owner(parent, fk, row[fk]);
			scope.assertTeam(team);
			if (team) row.team_id = team;
		} else if (!optional) {
			throw refError(fk, 'REQUIRED', 'Required');
		} else if (!scope.isAdmin) {
			row.team_id = scope.teamId; // optional parent (e.g. product item without a project): belongs to the manager's team
		}
	}
	for (const c of resource.parentChecks || []) scope.assertTeam(owner(c.parent, c.fk, row[c.fk]));
	if (resource.scopeVia) {
		scope.assertTeam(owner(resource.scopeVia.parent, resource.scopeVia.fk, row[resource.scopeVia.fk]));
		scope.assertTeam(owner('employees', 'employee_id', row.employee_id));
	}
	if (resource.table === 'employees' && row.reports_to_employee_id) scope.assertTeam(owner('employees', 'reports_to_employee_id', row.reports_to_employee_id));

	// Resources that own their team column (employees.primary_team_id, projects.team_id):
	// managers are always pinned to their team; admins choose.
	if (resource.teamColumn && resource.teamColumn !== 'ROWID' && !resource.teamFrom) {
		if (!scope.isAdmin) row[resource.teamColumn] = scope.teamId;
	}
	return row;
}

module.exports = { safeKey, immutableFields, matchKeyFor, prepareRow, loadReferences, applyReferences, referencedIds };
