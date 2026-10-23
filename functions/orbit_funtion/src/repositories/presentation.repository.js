'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');

const COLS = 'ROWID, title, team_id, created_by_user_id, status, last_presented_at, is_deleted, CREATEDTIME, MODIFIEDTIME';
const LIST_COLS = `${COLS}, slides_config`; // the list derives a small cover from it and never returns the config itself
const SCOPED = Symbol('scopedBy');

/** saved_presentations: visible to managers of team_id; admins see all (incl. team-less decks). */
function createPresentationRepository(db) {
	const base = (scope) => ['is_deleted = false', scope.condition('team_id')].filter(Boolean).join(' AND ');
	return {
		async list(scope, { offset, pageSize, page }) {
			assertScope(scope);
			const where = base(scope);
			const [total, rows] = await Promise.all([
				db.count(`SELECT COUNT(ROWID) AS total FROM saved_presentations WHERE ${where}`),
				db.select(`SELECT ${LIST_COLS} FROM saved_presentations WHERE ${where} ORDER BY MODIFIEDTIME desc, ROWID desc LIMIT ${offset}, ${pageSize}`, 'saved_presentations'),
			]);
			return { rows: rows.map(({ is_deleted, ...r }) => r), total, page, pageSize };
		},
		async findById(scope, id, { withSlides = false } = {}) {
			assertScope(scope);
			const rows = await db.select(`SELECT ${COLS}${withSlides ? ', slides_config' : ''} FROM saved_presentations WHERE ROWID = ${lit('id', id)} AND ${base(scope)} LIMIT 0, 1`, 'saved_presentations');
			const row = rows[0] || null;
			if (row) Object.defineProperty(row, SCOPED, { value: scope, enumerable: false });
			return row;
		},
		insert(scope, row) {
			assertScope(scope);
			scope.assertTeam(row.team_id);
			return db.insert('saved_presentations', row);
		},
		update(scope, existing, patch) {
			assertScope(scope);
			if (!existing || existing[SCOPED] !== scope) throw new Error('update requires a row loaded through findById with the same scope');
			if (patch.team_id !== undefined) scope.assertTeam(patch.team_id);
			return db.update('saved_presentations', { ...patch, ROWID: existing.ROWID });
		},
	};
}

module.exports = { createPresentationRepository };
