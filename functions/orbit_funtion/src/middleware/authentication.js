'use strict';

const { errors } = require('../utils/errors');
const { isId } = require('../validators/schema');
const { ROLES } = require('../config/constants');
const { SCOPE_TYPES } = require('../config/permissions');

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
		clear: () => map.clear(),
	};
}

/**
 * `repos` gives access to the users and access tables; `access` is the role/permission resolver.
 * The actor it returns carries everything authorization needs: the effective permission set and
 * the team scope of the user's role. `role` stays as the legacy name ("admin" = sees every team,
 * "manager" = one team) because existing code and the UI read it.
 */
async function authenticate(userApp, repos, { userCache: cache, access }) {
	const users = repos.users;
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
	if (!u) throw errors.forbidden('Your account has not been provisioned for Meeting 360', 'NOT_PROVISIONED');
	if (u.is_active !== true) throw errors.forbidden('Your account is inactive', 'ACCOUNT_INACTIVE');
	if (u.app_role !== ROLES.ADMIN && u.app_role !== ROLES.MANAGER) throw errors.forbidden('Your account has no valid role', 'INVALID_ROLE');
	const role = await access.resolve(repos.access, u);
	const ownTeam = role.scopeType === SCOPE_TYPES.OWN_TEAM;
	if (ownTeam && !isId(String(u.team_id || ''))) {
		throw errors.forbidden('Your account is not assigned to a team', 'MANAGER_TEAM_MISSING');
	}
	return {
		userId: String(u.ROWID),
		email: u.email,
		displayName: u.display_name || u.email,
		role: ownTeam ? ROLES.MANAGER : ROLES.ADMIN,
		roleKey: role.roleKey,
		roleName: role.roleName,
		roleId: role.roleId,
		scopeType: role.scopeType,
		permissions: role.permissions,
		accessSource: role.source,
		teamId: ownTeam ? String(u.team_id) : null,
	};
}

module.exports = { authenticate, createUserCache };
