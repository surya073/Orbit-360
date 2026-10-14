'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');

const COLS = 'ROWID, team_id, report_type, period_start, period_end, summary_json, generated_at, expires_at, status';

/** report_snapshots: frozen dashboard outputs. Team-less snapshots are admin-only. */
function createSnapshotRepository(db) {
	return {
		insert(scope, row) {
			assertScope(scope);
			scope.assertTeam(row.team_id);
			return db.insert('report_snapshots', row);
		},
		/** Newest first; metadata only (the summary payload is fetched per snapshot). */
		async list(scope, { offset, pageSize, page }) {
			assertScope(scope);
			const cond = scope.condition('team_id');
			const where = cond ? ` WHERE ${cond}` : '';
			const [total, rows] = await Promise.all([
				db.count(`SELECT COUNT(ROWID) AS total FROM report_snapshots${where}`),
				db.select(`SELECT ROWID, team_id, report_type, period_start, period_end, generated_at, expires_at, status FROM report_snapshots${where} ORDER BY ROWID desc LIMIT ${offset}, ${pageSize}`, 'report_snapshots'),
			]);
			return { rows, total, page, pageSize };
		},
		async findById(scope, id) {
			assertScope(scope);
			const cond = [`ROWID = ${lit('id', id)}`];
			const t = scope.condition('team_id');
			if (t) cond.push(t);
			const rows = await db.select(`SELECT ${COLS} FROM report_snapshots WHERE ${cond.join(' AND ')} LIMIT 0, 1`, 'report_snapshots');
			return rows[0] || null;
		},
	};
}

module.exports = { createSnapshotRepository };
