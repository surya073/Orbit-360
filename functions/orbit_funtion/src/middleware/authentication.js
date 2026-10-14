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
const MAX_CACHED_USERS = 500;

/**
 * Per-instance cache of `users` rows keyed by the VERIFIED Catalyst user id (never by anything
 * the client sends), so it cannot mix identities. Saves one Data Store request per API call;
 * a role/team/active change takes effect within `ttlSeconds`. 0 disables it.
 */
function createUserCache(ttlSeconds) {
	const map = new Map();
	const ttl = ttlSeconds * 1000;
	return {
		get(id) {
			const hit = map.get(id);
			if (!hit) return undefined;
			if (hit.until <= Date.now()) {
				map.delete(id);
				return undefined;
			}
			return hit.row;
		},
		set(id, row) {
			if (!ttl || !row) return;
			if (map.size >= MAX_CACHED_USERS) map.delete(map.keys().next().value);
			map.set(id, { row, until: Date.now() + ttl });
		},
	};
}

async function authenticate(userApp, users, cache) {
	let current;
	try {
		current = await userApp.userManagement().getCurrentUser();
	} catch {
		throw errors.unauthenticated();
	}
	if (!current || !isId(String(current.user_id))) throw errors.unauthenticated();

	const catalystId = String(current.user_id);
	let u = cache ? cache.get(catalystId) : undefined;
	if (!u) {
		u = await users.findByCatalystId(catalystId);
		if (cache) cache.set(catalystId, u);
	}
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

module.exports = { authenticate, createUserCache };
