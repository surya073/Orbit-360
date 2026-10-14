'use strict';

const { assertScope } = require('../services/scope.service');
const { buildListQueries, lit } = require('./queryBuilder');
const { LIMITS } = require('../config/constants');
const { resources } = require('../config/resources');

const SCOPED = Symbol('scopedBy'); // marks rows returned by a scoped read

/**
 * Generic repository for one Data Store table. All access requires a Scope; controllers and
 * services never build SQL. Lists issue exactly 2 queries (count + page).
 */
function createTableRepository(db, resource) {
	const detailBools = [...new Set([...(resource.bools || []), ...Object.entries(resource.fields || {}).filter(([, s]) => s.t === 'bool').map(([k]) => k)])];

	/** Team that owns a row of a table without its own team column (project_assignments -> project). */
	async function viaParentTeam(row) {
		const { fk, parent } = resource.scopeVia;
		const rows = await db.select(`SELECT ROWID, team_id FROM ${resources[parent].table} WHERE ROWID = ${lit('id', row[fk])} LIMIT 0, 1`, resources[parent].table);
		return rows[0] ? rows[0].team_id : null;
	}

	return {
		resource,

		async list(scope, input) {
			const q = buildListQueries(resource, input, scope);
			const [total, rows] = await Promise.all([db.count(q.countSql), db.select(q.listSql, resource.table, resource.bools)]);
			return { rows, total, page: q.page, pageSize: q.pageSize };
		},

		/**
		 * Scoped single-row read. Rows outside the caller's scope are indistinguishable from
		 * missing rows (null), which prevents IDOR / existence probing.
		 */
		async findById(scope, id, { detail = false } = {}) {
			assertScope(scope);
			const cond = [`ROWID = ${lit('id', id)}`];
			if (resource.softDelete) cond.push('is_deleted = false');
			if (resource.teamColumn) {
				const c = scope.condition(resource.teamColumn);
				if (c) cond.push(c);
			}
			const cols = detail ? '*' : resource.softDelete ? [...resource.list, 'is_deleted'].join(', ') : resource.list.join(', ');
			const rows = await db.select(`SELECT ${cols} FROM ${resource.table} WHERE ${cond.join(' AND ')} LIMIT 0, 1`, resource.table, detail ? detailBools : resource.bools);
			const row = rows[0] || null;
			if (!row) return null;
			if (!resource.teamColumn && resource.scopeVia && !scope.isAdmin) {
				if (!scope.canAccessTeam(await viaParentTeam(row))) return null;
			}
			Object.defineProperty(row, SCOPED, { value: scope, enumerable: false });
			return row;
		},

		async insert(scope, row) {
			assertScope(scope);
			if (resource.teamColumn && resource.teamColumn !== 'ROWID') scope.assertTeam(row[resource.teamColumn]);
			return db.insert(resource.table, row);
		},

		/** `existing` must come from findById() under the same scope. */
		async update(scope, existing, patch) {
			assertScope(scope);
			if (!existing || existing[SCOPED] !== scope) throw new Error('update requires a row loaded through findById with the same scope');
			if (resource.teamColumn && resource.teamColumn !== 'ROWID' && patch[resource.teamColumn] !== undefined) scope.assertTeam(patch[resource.teamColumn]);
			return db.update(resource.table, { ...patch, ROWID: existing.ROWID });
		},

		/** Bulk create; callers have already scoped each row. At most one Data Store request. */
		insertMany(scope, rows) {
			assertScope(scope);
			if (resource.teamColumn && resource.teamColumn !== 'ROWID') rows.forEach((r) => scope.assertTeam(r[resource.teamColumn]));
			return db.insertMany(resource.table, rows);
		},

		updateMany(scope, rows) {
			assertScope(scope);
			return db.updateMany(resource.table, rows);
		},

		/**
		 * Existing rows for a batch of match keys, in chunks of <= maxInClause keys. Returns the
		 * owning team so callers can refuse cross-team targets. Soft-deleted rows are included
		 * because unique constraints still apply to them.
		 */
		async findByKeys(scope, column, keys, extraColumns = []) {
			assertScope(scope);
			const unique = [...new Set(keys)];
			const team = resource.teamColumn && resource.teamColumn !== 'ROWID' ? [resource.teamColumn] : [];
			const cols = [...new Set(['ROWID', column, ...team, ...(resource.softDelete ? ['is_deleted'] : []), ...extraColumns])];
			const out = [];
			for (let i = 0; i < unique.length; i += LIMITS.maxInClause) {
				const chunk = unique.slice(i, i + LIMITS.maxInClause);
				const rows = await db.select(`SELECT ${cols.join(', ')} FROM ${resource.table} WHERE ${column} IN (${chunk.map((k) => lit('str', k)).join(', ')}) LIMIT 0, ${LIMITS.maxInClause}`, resource.table, ['is_deleted']);
				out.push(...rows);
			}
			return out;
		},

		/**
		 * Owning team for a set of ids (used to authorize references such as employee_id on a new
		 * time entry). One query per <=50 ids, never one per id. Returns Map(id -> teamId|null).
		 * Reads only ROWID + team, so this does not leak record contents.
		 */
		async ownersOf(ids) {
			const unique = [...new Set(ids.map(String))];
			const teamCol = resource.teamColumn;
			const map = new Map();
			for (let i = 0; i < unique.length; i += LIMITS.maxInClause) {
				const chunk = unique.slice(i, i + LIMITS.maxInClause);
				const cols = ['ROWID', ...(teamCol ? [teamCol] : [])].join(', ');
				const soft = resource.softDelete ? ' AND is_deleted = false' : '';
				const rows = await db.select(`SELECT ${cols} FROM ${resource.table} WHERE ROWID IN (${chunk.map((k) => lit('id', k)).join(', ')})${soft} LIMIT 0, ${LIMITS.maxInClause}`, resource.table);
				rows.forEach((r) => map.set(String(r.ROWID), teamCol ? (r[teamCol] ? String(r[teamCol]) : null) : null));
			}
			return map;
		},
	};
}

module.exports = { createTableRepository, SCOPED };
