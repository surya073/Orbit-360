'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');

const ROSTER_MAX = 300; // ZCQL returns at most 300 rows per SELECT
const NODE_COLS = 'ROWID, setting_key, setting_value';
const SCOPE = 'orgtree';

/**
 * Reporting structure storage. Each employee placed in a team's reporting tree is ONE row in
 * application_settings (scope 'orgtree', so the generic settings list never returns them), keyed
 * by the stable employee id. This keeps the tree out of the imported `employees` source columns
 * and needs no new table. All reads are bounded to a single SELECT.
 */
function createReportingRepository(db) {
	return {
		ROSTER_MAX,
		SCOPE,
		/** Active employees of one team (the only people that can appear in that team's tree). */
		roster(scope, teamId) {
			assertScope(scope);
			return db.select(
				`SELECT ROWID, employee_code, full_name, email_normalized, job_role, employment_status, primary_team_id, reports_to_employee_id FROM employees WHERE primary_team_id = ${lit('id', teamId)} AND is_deleted = false ORDER BY full_name asc LIMIT 0, ${ROSTER_MAX}`,
				'employees'
			);
		},
		async team(scope, teamId) {
			assertScope(scope);
			const rows = await db.select(`SELECT ROWID, name FROM teams WHERE ROWID = ${lit('id', teamId)} LIMIT 0, 1`, 'teams');
			return rows[0] || null;
		},
		nodes(scope, teamId) {
			assertScope(scope);
			return db.select(`SELECT ${NODE_COLS} FROM application_settings WHERE scope = '${SCOPE}' AND team_id = ${lit('id', teamId)} LIMIT 0, ${ROSTER_MAX}`, 'application_settings');
		},
		insertMany: (rows) => db.insertMany('application_settings', rows),
		updateMany: (rows) => db.updateMany('application_settings', rows),
	};
}

module.exports = { createReportingRepository };
