'use strict';

const { assertScope } = require('../services/scope.service');
const { errors } = require('../utils/errors');

/** Quotes an already-validated value. Types other than id/bool are quoted; validators guarantee safe shapes. */
function lit(type, value) {
	if (type === 'id' || type === 'bool') {
		if (!/^(\d{1,20}|true|false)$/.test(String(value))) throw new Error('unsafe literal');
		return String(value);
	}
	if (/['"\\;]/.test(String(value))) throw new Error('unsafe literal');
	return `'${value}'`;
}

/**
 * WHERE clause for a resource listing. Team scope is applied here, inside the repository
 * layer, from a required Scope. `input` is the output of listQuery() validation.
 */
/**
 * `col LIKE '%term%'` that does not depend on the data store's case rules: the (already sanitised)
 * term is matched as typed, lower case, UPPER case and Title Case, so "asha" finds "Asha Rao".
 * Returns a flat list of conditions to be OR-ed by the caller (no nested brackets).
 */
function likeVariants(col, term) {
	const title = term.toLowerCase().replace(/(^|[ \-_.@])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
	const variants = [...new Set([term, term.toLowerCase(), term.toUpperCase(), title])];
	return variants.map((v) => `${col} LIKE '%${v}%'`);
}

function buildWhere(resource, input, scope, refIds = {}) {
	assertScope(scope);
	const c = [];
	if (resource.softDelete) c.push('is_deleted = false');

	if (resource.teamColumn) {
		const team = scope.resolveTeam(input.team_id);
		if (team) c.push(`${resource.teamColumn} = ${lit('id', team)}`);
	} else if (input.team_id !== undefined) {
		// Tables without a team column cannot be filtered by team; reject rather than ignore.
		throw errors.badRequest('team_id filter is not supported for this resource');
	}
	if (input.ids) c.push(`ROWID IN (${input.ids.map((i) => lit('id', i)).join(', ')})`);
	for (const [name, value] of Object.entries(input.filters || {})) {
		c.push(`${name} = ${lit(resource.filters[name], value)}`);
	}
	if (resource.dateColumn) {
		if (input.from) c.push(`${resource.dateColumn} >= ${lit('date', input.from)}`);
		if (input.to) c.push(`${resource.dateColumn} <= ${lit('date', input.to)}`);
	}
	if (input.q && (resource.search || resource.searchRefs)) {
		// Own text column OR a reference (e.g. employee_id) whose parent record's name matches.
		// refIds come from a bounded parent lookup done by the repository; q is already sanitised.
		const parts = [];
		if (resource.search) parts.push(...likeVariants(resource.search, input.q));
		for (const ref of resource.searchRefs || []) {
			const ids = refIds[ref.fk] || [];
			if (ids.length) parts.push(`${ref.fk} IN (${ids.map((i) => lit('id', i)).join(', ')})`);
		}
		c.push(parts.length > 1 ? `(${parts.join(' OR ')})` : parts.length === 1 ? parts[0] : 'ROWID = 0');
	}
	return c.length ? ` WHERE ${c.join(' AND ')}` : '';
}

function buildOrder(resource, input) {
	const [defCol, defDir] = resource.defaultSort || ['ROWID', 'asc'];
	const col = input.sort || defCol;
	const dir = input.dir || defDir;
	// ROWID tiebreaker keeps pagination stable.
	return ` ORDER BY ${col} ${dir}, ROWID ${dir}`;
}

/** Explicit column list only (ZCQL allows max 20 columns per SELECT; never SELECT * for lists). */
function buildListQueries(resource, input, scope, refIds) {
	const where = buildWhere(resource, input, scope, refIds);
	const { page, pageSize, offset } = input.paging;
	return {
		page,
		pageSize,
		countSql: `SELECT COUNT(ROWID) AS total FROM ${resource.table}${where}`,
		listSql: `SELECT ${resource.list.join(', ')} FROM ${resource.table}${where}${buildOrder(resource, input)} LIMIT ${offset}, ${pageSize}`,
	};
}

module.exports = { buildListQueries, buildWhere, likeVariants, lit };
