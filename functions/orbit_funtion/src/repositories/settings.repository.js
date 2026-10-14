'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');

const COLS = 'ROWID, setting_key, scope, team_id, setting_value, value_type, description';

/** application_settings: global values plus per-team overrides. A small table; reads are bounded to 300 rows. */
function createSettingsRepository(db) {
	return {
		list(scope) {
			assertScope(scope);
			const where = scope.isAdmin ? `scope = 'global' OR scope = 'team'` : `scope = 'global' OR (scope = 'team' AND team_id = ${lit('id', scope.teamId)})`;
			return db.select(`SELECT ${COLS} FROM application_settings WHERE ${where} ORDER BY setting_key asc LIMIT 0, 300`, 'application_settings');
		},
		async findByKey(dedupeKey) {
			const rows = await db.select(`SELECT ROWID FROM application_settings WHERE dedupe_key = ${lit('str', dedupeKey)} LIMIT 0, 1`, 'application_settings');
			return rows[0] || null;
		},
		insert: (row) => db.insert('application_settings', row),
		update: (row) => db.update('application_settings', row),
	};
}

module.exports = { createSettingsRepository };
