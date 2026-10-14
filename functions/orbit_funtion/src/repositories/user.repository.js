'use strict';

const { lit } = require('./queryBuilder');

/** Application users (Catalyst identity -> role + team). Read-only from the API. */
function createUserRepository(db) {
	return {
		async findByCatalystId(catalystUserId) {
			const rows = await db.select(
				`SELECT ROWID, catalyst_user_id, email, display_name, app_role, team_id, is_active FROM users WHERE catalyst_user_id = ${lit('str', catalystUserId)} LIMIT 0, 1`,
				'users',
				['is_active']
			);
			return rows[0] || null;
		},
	};
}

module.exports = { createUserRepository };
