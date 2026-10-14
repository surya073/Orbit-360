'use strict';

const { errors } = require('../utils/errors');
const { isId } = require('../validators/schema');
const { ROLES } = require('../config/constants');

/**
 * Resolves the caller from Catalyst Authentication (verified session), then maps them to the
 * application role/team in the `users` table. The client never supplies role or team.
 *
 * userApp  - SDK initialised with the caller's identity: catalyst.initialize(req)
 * users    - user repository (admin-scope data access)
 *
 * Fails closed: if the identity cannot be verified the request is rejected. There is no
 * development bypass in this module.
 */
async function authenticate(userApp, users) {
	let current;
	try {
		current = await userApp.userManagement().getCurrentUser();
	} catch {
		throw errors.unauthenticated();
	}
	if (!current || !isId(String(current.user_id))) throw errors.unauthenticated();

	const u = await users.findByCatalystId(String(current.user_id));
	if (!u) throw errors.forbidden('Your account has not been provisioned for Company 360', 'NOT_PROVISIONED');
	if (u.is_active !== true) throw errors.forbidden('Your account is inactive', 'ACCOUNT_INACTIVE');
	if (u.app_role !== ROLES.ADMIN && u.app_role !== ROLES.MANAGER) throw errors.forbidden('Your account has no valid role', 'INVALID_ROLE');
	if (u.app_role === ROLES.MANAGER && !isId(String(u.team_id || ''))) {
		throw errors.forbidden('Your manager account is not assigned to a team', 'MANAGER_TEAM_MISSING');
	}
	return {
		userId: String(u.ROWID),
		email: u.email,
		displayName: u.display_name || u.email,
		role: u.app_role,
		teamId: u.app_role === ROLES.MANAGER ? String(u.team_id) : null,
	};
}

module.exports = { authenticate };
