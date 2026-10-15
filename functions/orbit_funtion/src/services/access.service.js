'use strict';

const { ApiError, errors } = require('../utils/errors');
const { requirePermission, can } = require('../middleware/authorization');
const { ALL_KEYS, DEFAULT_ROLES, SCOPE_TYPES, PROTECTED_ROLE_KEY, catalog, isPermissionKey } = require('../config/permissions');
const { isSchemaError } = require('./accessResolver');
const { audit } = require('./audit.service');
const { MAX_BULK } = require('../config/datastore');

/**
 * Access & Permissions: roles, what each role may do, and which role each user holds.
 *
 * Safety rules enforced here (the UI only mirrors them):
 *   - every change needs the matching permission (access.manage_roles / access.manage_users);
 *   - the protected Administrator role cannot be edited, deactivated or created again, and only an
 *     Administrator may change an Administrator;
 *   - nobody can change their own access, so a mistake or a stolen session cannot escalate itself;
 *   - nobody can grant a permission, or a team scope, that they do not hold themselves;
 *   - the last active Administrator can never be demoted or deactivated;
 *   - changes are written to the audit log and take effect immediately on this instance (other
 *     instances within USER_CACHE_SECONDS).
 */

const tablesMissing = () => new ApiError(409, 'ACCESS_TABLES_MISSING', 'The access tables have not been created yet. Create them as described in data/access-permissions-schema.md, then try again.');
const escalation = (message) => errors.forbidden(message, 'ESCALATION_DENIED');
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));
const isAdminActor = (ctx) => ctx.actor.roleKey === PROTECTED_ROLE_KEY;
const bool = (v) => (v ? 'true' : 'false');

/** Runs a write-path repository call; a missing access table becomes one clear, actionable error. */
async function needTables(fn) {
	try {
		return await fn();
	} catch (err) {
		if (isSchemaError(err)) throw tablesMissing();
		throw err;
	}
}

// ---- reading roles ------------------------------------------------------------------------------

const modelOf = (row, allowed, revoked) => ({
	id: String(row.ROWID),
	key: row.role_key,
	name: row.name,
	description: row.description || '',
	scopeType: row.scope_type,
	isSystem: row.is_system === true,
	isProtected: row.role_key === PROTECTED_ROLE_KEY,
	isActive: row.is_active !== false,
	permissions: row.role_key === PROTECTED_ROLE_KEY ? [...ALL_KEYS] : allowed,
	revoked,
	source: 'database',
});

const defaultModel = (key) => {
	const d = DEFAULT_ROLES[key];
	return { id: null, key: d.key, name: d.name, description: d.description, scopeType: d.scopeType, isSystem: true, isProtected: key === PROTECTED_ROLE_KEY, isActive: true, permissions: [...d.permissions], revoked: [], source: 'default' };
};

/** Roles as stored, plus the built-in roles that have no stored row yet. `withGrants` also loads each role's permissions. */
async function loadRoles(ctx, { withGrants }) {
	const repo = ctx.repos.access;
	let rows = [];
	let tablesReady = true;
	try {
		rows = await repo.listRoles();
	} catch (err) {
		if (!isSchemaError(err)) throw err;
		tablesReady = false;
	}
	const models = [];
	for (const row of rows) {
		let allowed = [];
		let revoked = [];
		if (withGrants && row.role_key !== PROTECTED_ROLE_KEY) {
			try {
				const grants = await repo.grants(row.ROWID);
				allowed = grants.filter((g) => g.is_allowed === true && isPermissionKey(g.permission_key)).map((g) => g.permission_key);
				revoked = grants.filter((g) => g.is_allowed !== true && isPermissionKey(g.permission_key)).map((g) => g.permission_key);
			} catch (err) {
				if (!isSchemaError(err)) throw err;
				tablesReady = false;
			}
		}
		models.push(modelOf(row, allowed, revoked));
	}
	for (const key of Object.keys(DEFAULT_ROLES)) if (!models.some((m) => m.key === key)) models.push(defaultModel(key));
	models.sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name));
	return { tablesReady, models };
}

/** user rows + assignments -> effective role of each user (explicit assignment, else the legacy admin/manager role). */
function effectiveRoles(users, assignments, models) {
	const byId = new Map(models.filter((m) => m.id).map((m) => [m.id, m]));
	const byKey = new Map(models.map((m) => [m.key, m]));
	const assigned = new Map(assignments.map((a) => [String(a.user_id), String(a.role_id)]));
	return new Map(
		users.map((u) => {
			const roleId = assigned.get(String(u.ROWID));
			const explicit = roleId ? byId.get(roleId) : null;
			const legacy = byKey.get(u.app_role === PROTECTED_ROLE_KEY ? PROTECTED_ROLE_KEY : 'manager');
			return [String(u.ROWID), explicit ? { role: explicit, source: 'assigned' } : { role: legacy, source: 'default' }];
		})
	);
}

const userModel = (u, eff) => ({
	id: String(u.ROWID),
	email: u.email,
	displayName: u.display_name || u.email,
	teamId: u.team_id ? String(u.team_id) : null,
	isActive: u.is_active === true,
	roleId: eff.role && eff.role.id,
	roleKey: eff.role ? eff.role.key : null,
	roleName: eff.role ? eff.role.name : null,
	roleSource: eff.source,
});

// ---- queries -------------------------------------------------------------------------------------

async function getCatalog(ctx) {
	requirePermission(ctx, 'access.view');
	return catalog();
}

async function listRoles(ctx) {
	requirePermission(ctx, 'access.view');
	const { tablesReady, models } = await loadRoles(ctx, { withGrants: true });
	const repo = ctx.repos.access;
	let users = [];
	let assignments = [];
	try {
		[users, assignments] = await Promise.all([repo.allUsers(), repo.allAssignments()]);
	} catch (err) {
		if (!isSchemaError(err)) throw err;
	}
	if (!ctx.scope.isAdmin) users = users.filter((u) => String(u.team_id) === ctx.scope.teamId); // counts never reveal other teams
	const eff = effectiveRoles(users, assignments, models);
	const counts = new Map();
	for (const { role } of eff.values()) if (role) counts.set(role.key, (counts.get(role.key) || 0) + 1);
	return {
		tablesReady,
		you: { roleKey: ctx.actor.roleKey, canManageRoles: can(ctx.actor, 'access.manage_roles'), canManageUsers: can(ctx.actor, 'access.manage_users') },
		roles: models.map((m) => ({ ...m, userCount: counts.get(m.key) || 0 })),
	};
}

async function listUsers(ctx, q) {
	requirePermission(ctx, 'access.view');
	const repo = ctx.repos.access;
	const teamId = ctx.scope.isAdmin ? q.teamId || null : ctx.scope.teamId; // a team-scoped manager only ever sees their own team
	const [rows, total] = await Promise.all([repo.listUsers({ teamId, q: q.q, offset: q.paging.offset, limit: q.paging.pageSize }), repo.countUsers({ teamId, q: q.q })]);
	let assignments = [];
	try {
		assignments = await repo.assignments(rows.map((r) => String(r.ROWID)));
	} catch (err) {
		if (!isSchemaError(err)) throw err;
	}
	const { models } = await loadRoles(ctx, { withGrants: false });
	const eff = effectiveRoles(rows, assignments, models);
	return { rows: rows.map((u) => userModel(u, eff.get(String(u.ROWID)))), total, page: q.paging.page, pageSize: q.paging.pageSize };
}

// ---- role changes --------------------------------------------------------------------------------

const slug = (name) =>
	String(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40);

function assertCanGrant(ctx, keys) {
	for (const key of keys) {
		if (!can(ctx.actor, key)) throw escalation(`You cannot grant a permission you do not hold yourself (${key})`);
	}
}

function assertScopeAllowed(ctx, scopeType) {
	if (scopeType === SCOPE_TYPES.ALL_TEAMS && ctx.actor.scopeType !== SCOPE_TYPES.ALL_TEAMS) {
		throw escalation('Only someone who can see every team can create, change or assign an all-teams role');
	}
}

const grantRows = (roleId, keys) => keys.map((k) => ({ role_id: roleId, permission_key: k, is_allowed: 'true', dedupe_key: `${roleId}|${k}` }));
async function insertGrants(repo, rows) {
	for (const part of chunks(rows, MAX_BULK)) await repo.insertGrants(part);
}

/** Stores a built-in role (e.g. the default Manager) the first time it is edited or assigned, copying its defaults. */
async function materialize(ctx, key) {
	const repo = ctx.repos.access;
	const d = DEFAULT_ROLES[key];
	const created = await needTables(() => repo.insertRole({ role_key: d.key, name: d.name, description: d.description, scope_type: d.scopeType, is_system: 'true', is_active: 'true' }));
	if (key !== PROTECTED_ROLE_KEY) await needTables(() => insertGrants(repo, grantRows(String(created.ROWID), d.permissions)));
	await audit(ctx, { action: 'create', table: 'roles', rowId: created.ROWID, after: { role_key: d.key, source: 'built-in defaults' } });
	return needTables(() => repo.findRole(created.ROWID));
}

/** A role from a numeric id or a built-in key; built-in roles are stored on first use. */
async function roleFromRef(ctx, ref) {
	const repo = ctx.repos.access;
	const isKey = Object.prototype.hasOwnProperty.call(DEFAULT_ROLES, ref);
	let row = await needTables(() => (isKey ? repo.findRoleByKey(ref) : repo.findRole(ref)));
	if (!row && isKey) row = await materialize(ctx, ref);
	if (!row) throw errors.notFound('Role not found');
	return row;
}

function assertEditableRole(ctx, row) {
	if (row.role_key === PROTECTED_ROLE_KEY) throw errors.forbidden('The Administrator role is protected and cannot be changed', 'PROTECTED_ROLE');
	assertScopeAllowed(ctx, row.scope_type);
	if (ctx.actor.roleId && String(ctx.actor.roleId) === String(row.ROWID)) throw escalation('You cannot change the role you hold yourself');
	if (ctx.actor.roleKey === row.role_key) throw escalation('You cannot change the role you hold yourself');
}

async function currentGrants(repo, roleId) {
	return needTables(() => repo.grants(roleId));
}

async function createRole(ctx, body) {
	requirePermission(ctx, 'access.manage_roles');
	const repo = ctx.repos.access;
	const key = slug(body.name);
	if (!key) throw errors.validation([{ field: 'name', code: 'INVALID_VALUE', message: 'Use letters or numbers in the name' }]);
	assertScopeAllowed(ctx, body.scopeType);
	assertCanGrant(ctx, body.permissions);
	const existing = await needTables(() => repo.listRoles());
	if (Object.prototype.hasOwnProperty.call(DEFAULT_ROLES, key) || existing.some((r) => r.role_key === key || r.name.toLowerCase() === body.name.toLowerCase())) {
		throw errors.conflict('A role with this name already exists');
	}
	const created = await needTables(() => repo.insertRole({ role_key: key, name: body.name, ...(body.description ? { description: body.description } : {}), scope_type: body.scopeType, is_system: 'false', is_active: 'true' }));
	await needTables(() => insertGrants(repo, grantRows(String(created.ROWID), body.permissions)));
	await audit(ctx, { action: 'create', table: 'roles', rowId: created.ROWID, after: { role_key: key, scope_type: body.scopeType, permissions: body.permissions.length } });
	ctx.caches.clear();
	return { id: String(created.ROWID), key };
}

async function updateRole(ctx, ref, patch) {
	requirePermission(ctx, 'access.manage_roles');
	const repo = ctx.repos.access;
	const row = await roleFromRef(ctx, ref);
	assertEditableRole(ctx, row);
	const update = { ROWID: row.ROWID };
	if (patch.name !== undefined && patch.name !== row.name) {
		const others = await repo.listRoles();
		if (others.some((r) => String(r.ROWID) !== String(row.ROWID) && r.name.toLowerCase() === patch.name.toLowerCase())) throw errors.conflict('A role with this name already exists');
		update.name = patch.name;
	}
	if (patch.description !== undefined) update.description = patch.description;
	if (patch.isActive !== undefined && patch.isActive !== (row.is_active !== false)) {
		if (patch.isActive === false) {
			if (row.is_system === true) throw errors.forbidden('Built-in roles cannot be deactivated', 'PROTECTED_ROLE');
			const assigned = await repo.countAssigned(row.ROWID);
			if (assigned > 0) throw errors.conflict(`${assigned} user${assigned === 1 ? ' is' : 's are'} still assigned to this role. Move them to another role first.`);
		}
		update.is_active = bool(patch.isActive);
	}
	if (Object.keys(update).length > 1) {
		await repo.updateRole(update);
		await audit(ctx, { action: 'update', table: 'roles', rowId: row.ROWID, before: { name: row.name, is_active: row.is_active }, after: update });
		ctx.caches.clear();
	}
	return { id: String(row.ROWID) };
}

async function setRolePermissions(ctx, ref, keys) {
	requirePermission(ctx, 'access.manage_roles');
	const repo = ctx.repos.access;
	const row = await roleFromRef(ctx, ref);
	assertEditableRole(ctx, row);
	const existing = await currentGrants(repo, row.ROWID);
	const byKey = new Map(existing.map((g) => [g.permission_key, g]));
	const want = new Set(keys);
	const holding = new Set(existing.filter((g) => g.is_allowed === true).map((g) => g.permission_key));
	const added = keys.filter((k) => !holding.has(k));
	assertCanGrant(ctx, added); // you can only hand out what you hold; taking permissions away is always allowed
	const inserts = [];
	const updates = [];
	for (const k of want) {
		const g = byKey.get(k);
		if (!g) inserts.push(...grantRows(String(row.ROWID), [k]));
		else if (g.is_allowed !== true) updates.push({ ROWID: g.ROWID, is_allowed: 'true' });
	}
	const removed = [...holding].filter((k) => !want.has(k));
	for (const k of removed) updates.push({ ROWID: byKey.get(k).ROWID, is_allowed: 'false' });
	await needTables(() => insertGrants(repo, inserts));
	for (const part of chunks(updates, MAX_BULK)) await needTables(() => repo.updateGrants(part));
	await audit(ctx, { action: 'update', table: 'role_permissions', rowId: row.ROWID, after: { role_key: row.role_key, granted: added, revoked: removed } });
	ctx.caches.clear();
	return { id: String(row.ROWID), granted: added.length, revoked: removed.length };
}

// ---- user changes --------------------------------------------------------------------------------

/** Number of OTHER active users who currently hold the protected Administrator role. */
async function otherActiveAdmins(ctx, excludeUserId) {
	const repo = ctx.repos.access;
	const { models } = await loadRoles(ctx, { withGrants: false });
	const adminModel = models.find((m) => m.key === PROTECTED_ROLE_KEY);
	const candidates = await repo.activeAdminUsers(); // legacy and synced administrators
	const assignedToAdmin = adminModel && adminModel.id ? await repo.assignedTo(adminModel.id) : [];
	const ids = new Set([...candidates.map((c) => String(c.ROWID)), ...assignedToAdmin.map((a) => String(a.user_id))]);
	ids.delete(String(excludeUserId));
	let count = 0;
	for (const id of ids) {
		const u = await repo.findUser(id);
		if (!u || u.is_active !== true) continue;
		const a = await repo.assignmentFor(id);
		const key = a ? (models.find((m) => m.id === String(a.role_id)) || {}).key : u.app_role === PROTECTED_ROLE_KEY ? PROTECTED_ROLE_KEY : 'manager';
		if (key === PROTECTED_ROLE_KEY) count += 1;
	}
	return count;
}

async function updateUser(ctx, id, patch) {
	requirePermission(ctx, 'access.manage_users');
	const repo = ctx.repos.access;
	const target = await repo.findUser(id);
	// A team-scoped manager cannot even tell whether users of other teams exist.
	if (!target || (!ctx.scope.isAdmin && String(target.team_id) !== ctx.scope.teamId)) throw errors.notFound('User not found');
	if (String(target.ROWID) === String(ctx.actor.userId)) throw escalation('You cannot change your own access. Ask another administrator.');

	const { models } = await loadRoles(ctx, { withGrants: false });
	const assignment = await needTables(() => repo.assignmentFor(target.ROWID));
	const current = effectiveRoles([target], assignment ? [assignment] : [], models).get(String(target.ROWID)).role;
	if (current && current.key === PROTECTED_ROLE_KEY && !isAdminActor(ctx)) throw escalation('Only an Administrator can change an Administrator');

	// Final role (existing one unless changed)
	let finalRole = current;
	let newRoleRow = null;
	if (patch.roleId !== undefined) {
		newRoleRow = await roleFromRef(ctx, patch.roleId);
		if (newRoleRow.is_active === false) throw errors.conflict('That role is inactive');
		assertScopeAllowed(ctx, newRoleRow.scope_type);
		if (newRoleRow.role_key === PROTECTED_ROLE_KEY && !isAdminActor(ctx)) throw escalation('Only an Administrator can assign the Administrator role');
		if (newRoleRow.role_key !== PROTECTED_ROLE_KEY) {
			const granted = (await currentGrants(repo, newRoleRow.ROWID)).filter((g) => g.is_allowed === true).map((g) => g.permission_key);
			assertCanGrant(ctx, granted); // you cannot hand someone a role that can do more than you can
		}
		finalRole = { id: String(newRoleRow.ROWID), key: newRoleRow.role_key, scopeType: newRoleRow.scope_type };
	}

	// Team
	let teamId = target.team_id ? String(target.team_id) : null;
	if (patch.teamId !== undefined) {
		if (!ctx.scope.isAdmin) throw errors.forbidden('You can only manage users of your own team', 'FORBIDDEN');
		if (!(await repo.teamExists(patch.teamId))) throw errors.validation([{ field: 'teamId', code: 'NOT_FOUND', message: 'That team does not exist' }]);
		teamId = patch.teamId;
	}
	if (finalRole && finalRole.scopeType === SCOPE_TYPES.OWN_TEAM && !teamId) {
		throw errors.validation([{ field: 'teamId', code: 'REQUIRED', message: 'Choose a team: this role works with one team' }]);
	}

	// Lock-out protection
	const stillAdmin = finalRole && finalRole.key === PROTECTED_ROLE_KEY && (patch.isActive === undefined ? target.is_active === true : patch.isActive);
	if (current && current.key === PROTECTED_ROLE_KEY && target.is_active === true && !stillAdmin) {
		if ((await otherActiveAdmins(ctx, target.ROWID)) < 1) throw errors.conflict('At least one active Administrator is required. Make someone else an Administrator first.');
	}

	// Write: assignment first (authentication reads it), then the user row
	if (newRoleRow) {
		if (assignment) await needTables(() => repo.updateAssignment({ ROWID: assignment.ROWID, role_id: String(newRoleRow.ROWID), assigned_by_user_id: ctx.actor.userId }));
		else await needTables(() => repo.insertAssignment({ user_id: String(target.ROWID), role_id: String(newRoleRow.ROWID), assigned_by_user_id: ctx.actor.userId }));
	}
	const userUpdate = { ROWID: target.ROWID };
	// users.app_role stays a safe legacy mirror: only the protected Administrator role maps to "admin".
	if (newRoleRow) userUpdate.app_role = newRoleRow.role_key === PROTECTED_ROLE_KEY ? 'admin' : 'manager';
	if (patch.teamId !== undefined) userUpdate.team_id = patch.teamId;
	if (patch.isActive !== undefined) userUpdate.is_active = bool(patch.isActive);
	if (Object.keys(userUpdate).length > 1) await repo.updateUser(userUpdate);

	await audit(ctx, {
		action: 'update',
		table: 'users',
		rowId: target.ROWID,
		teamId: teamId || undefined,
		before: { role: current && current.key, team_id: target.team_id, is_active: target.is_active },
		after: { role: finalRole && finalRole.key, team_id: teamId, ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}) },
	});
	ctx.caches.clear();
	return { id: String(target.ROWID) };
}

module.exports = { getCatalog, listRoles, listUsers, createRole, updateRole, setRolePermissions, updateUser, slug };
