'use strict';

const { errors } = require('../utils/errors');
const { ALL_KEYS, DEFAULT_ROLES, SCOPE_TYPES, PROTECTED_ROLE_KEY, isPermissionKey } = require('../config/permissions');

const SCOPES = new Set(Object.values(SCOPE_TYPES));
const MAX_CACHED = 500;

/** A Data Store "table/column not found" failure: the access tables have not been created (yet). */
const isSchemaError = (err) => Boolean(err && err.code === 'DATASTORE_SCHEMA');

const builtIn = (key) => {
	const d = DEFAULT_ROLES[key];
	return { roleId: null, roleKey: d.key, roleName: d.name, scopeType: d.scopeType, isSystem: true, permissions: new Set(d.permissions), source: 'default' };
};

/**
 * Works out what a signed-in user may do.
 *
 *   1. the user's explicit assignment (table `user_roles`) names a role; otherwise the role that
 *      matches the legacy `users.app_role` ("admin" / "manager") is used;
 *   2. that role's permissions come from `role_permissions`; the protected "admin" role always holds
 *      every permission (its stored rows are ignored, so it can never be locked out or edited);
 *   3. if the access tables do not exist yet, or hold no row for a built-in role, the built-in
 *      defaults apply - exactly the behaviour the application had before roles were configurable.
 *
 * Anything that cannot be resolved cleanly (unknown scope, inactive role, assignment to a missing
 * role) is denied. Results are cached per function instance for `ttlSeconds`; every change made
 * through the Access API clears the cache immediately on that instance.
 */
function createAccessResolver(ttlSeconds = 0) {
	const ttl = ttlSeconds * 1000;
	const users = new Map();
	const roles = new Map();
	let missing = { until: 0 }; // access tables not created: skip the (failing) queries for a while

	const fresh = (entry) => entry && entry.until > Date.now();
	const put = (map, key, value) => {
		if (!ttl) return;
		if (map.size >= MAX_CACHED) map.delete(map.keys().next().value);
		map.set(key, { value, until: Date.now() + ttl });
	};

	async function loadRole(repo, row) {
		if (!SCOPES.has(row.scope_type)) throw errors.forbidden('Your role has an invalid scope', 'INVALID_ROLE');
		if (row.is_active === false) throw errors.forbidden('Your role is inactive', 'ROLE_INACTIVE');
		const isProtected = row.role_key === PROTECTED_ROLE_KEY;
		let permissions;
		if (isProtected) permissions = new Set(ALL_KEYS);
		else permissions = new Set((await repo.grants(row.ROWID)).filter((g) => g.is_allowed === true && isPermissionKey(g.permission_key)).map((g) => g.permission_key));
		return { roleId: String(row.ROWID), roleKey: row.role_key, roleName: row.name, scopeType: row.scope_type, isSystem: row.is_system === true, permissions, source: 'database' };
	}

	async function roleById(repo, id) {
		const key = `id:${id}`;
		const hit = roles.get(key);
		if (fresh(hit)) return hit.value;
		const row = await repo.findRole(id);
		const role = row ? await loadRole(repo, row) : null;
		put(roles, key, role);
		return role;
	}

	async function roleByKey(repo, roleKey) {
		const key = `key:${roleKey}`;
		const hit = roles.get(key);
		if (fresh(hit)) return hit.value;
		const row = await repo.findRoleByKey(roleKey);
		const role = row ? await loadRole(repo, row) : null;
		put(roles, key, role);
		return role;
	}

	async function resolve(repo, user) {
		const cached = users.get(String(user.ROWID));
		if (fresh(cached)) return cached.value;

		const legacyKey = user.app_role === PROTECTED_ROLE_KEY ? PROTECTED_ROLE_KEY : 'manager';
		let role = null;
		if (!fresh(missing)) {
			try {
				const assignment = await repo.assignmentFor(user.ROWID);
				if (assignment) {
					role = await roleById(repo, assignment.role_id);
					if (!role) throw errors.forbidden('Your assigned role no longer exists', 'ROLE_MISSING');
				} else {
					role = await roleByKey(repo, legacyKey);
				}
			} catch (err) {
				if (!isSchemaError(err)) throw err;
				missing = { until: Date.now() + (ttl || 1) };
			}
		}
		if (!role) role = builtIn(legacyKey);
		put(users, String(user.ROWID), role);
		return role;
	}

	return {
		resolve,
		/** True when the access tables answered the last probe (false = running on built-in defaults). */
		tablesAvailable: () => !fresh(missing),
		clear() {
			users.clear();
			roles.clear();
			missing = { until: 0 };
		},
	};
}

module.exports = { createAccessResolver, builtIn, isSchemaError };
