'use strict';

const { lit, likeVariants } = require('./queryBuilder');

const ROLE_COLS = 'ROWID, role_key, name, description, scope_type, is_system, is_active';
const ROLE_BOOLS = ['is_system', 'is_active'];
const USER_COLS = 'ROWID, catalyst_user_id, email, display_name, app_role, team_id, employee_id, is_active';
const MAX = 300; // ZCQL returns at most 300 rows per SELECT

// `q` is already sanitised by the validator; matched in a few letter cases (see likeVariants).
const searchCondition = (q) => `(${[...likeVariants('email', q), ...likeVariants('display_name', q)].join(' OR ')})`;
const idList = (ids) => ids.map((i) => lit('id', i)).join(', ');

/**
 * Storage for roles, their permission grants and user->role assignments (tables `roles`,
 * `role_permissions`, `user_roles`), plus the application `users` rows the Access screen manages.
 * Every list is a single bounded SELECT. These tables are created manually (see
 * data/access-permissions-schema.md); until they exist the resolver falls back to built-in roles.
 */
function createAccessRepository(db) {
	return {
		MAX,

		// ---- roles ---------------------------------------------------------------------------------
		listRoles: () => db.select(`SELECT ${ROLE_COLS} FROM roles ORDER BY name asc LIMIT 0, ${MAX}`, 'roles', ROLE_BOOLS),
		async findRole(id) {
			const rows = await db.select(`SELECT ${ROLE_COLS} FROM roles WHERE ROWID = ${lit('id', id)} LIMIT 0, 1`, 'roles', ROLE_BOOLS);
			return rows[0] || null;
		},
		async findRoleByKey(key) {
			const rows = await db.select(`SELECT ${ROLE_COLS} FROM roles WHERE role_key = ${lit('str', key)} LIMIT 0, 1`, 'roles', ROLE_BOOLS);
			return rows[0] || null;
		},
		insertRole: (row) => db.insert('roles', row),
		updateRole: (row) => db.update('roles', row),

		// ---- grants (one row per role + permission; is_allowed false = explicitly revoked) ----------
		grants: (roleId) => db.select(`SELECT ROWID, role_id, permission_key, is_allowed FROM role_permissions WHERE role_id = ${lit('id', roleId)} LIMIT 0, ${MAX}`, 'role_permissions', ['is_allowed']),
		insertGrants: (rows) => db.insertMany('role_permissions', rows),
		updateGrants: (rows) => db.updateMany('role_permissions', rows),

		// ---- assignments ---------------------------------------------------------------------------
		async assignmentFor(userId) {
			const rows = await db.select(`SELECT ROWID, user_id, role_id FROM user_roles WHERE user_id = ${lit('id', userId)} LIMIT 0, 1`, 'user_roles');
			return rows[0] || null;
		},
		assignments(userIds) {
			if (userIds.length === 0) return Promise.resolve([]);
			return db.select(`SELECT ROWID, user_id, role_id FROM user_roles WHERE user_id IN (${idList(userIds)}) LIMIT 0, ${MAX}`, 'user_roles');
		},
		insertAssignment: (row) => db.insert('user_roles', row),
		updateAssignment: (row) => db.update('user_roles', row),
		countAssigned: (roleId) => db.count(`SELECT COUNT(ROWID) AS total FROM user_roles WHERE role_id = ${lit('id', roleId)}`),
		allAssignments: () => db.select(`SELECT ROWID, user_id, role_id FROM user_roles LIMIT 0, ${MAX}`, 'user_roles'),
		assignedTo: (roleId) => db.select(`SELECT ROWID, user_id, role_id FROM user_roles WHERE role_id = ${lit('id', roleId)} LIMIT 0, ${MAX}`, 'user_roles'),

		// ---- users ---------------------------------------------------------------------------------
		async findUser(id) {
			const rows = await db.select(`SELECT ${USER_COLS} FROM users WHERE ROWID = ${lit('id', id)} LIMIT 0, 1`, 'users', ['is_active']);
			return rows[0] || null;
		},
		/** One page of users; `teamId` restricts to one team (managers of a team never see other teams' users). */
		listUsers({ teamId, q, offset, limit }) {
			const c = [];
			if (teamId) c.push(`team_id = ${lit('id', teamId)}`);
			if (q) c.push(searchCondition(q));
			return db.select(`SELECT ${USER_COLS} FROM users${c.length ? ` WHERE ${c.join(' AND ')}` : ''} ORDER BY email asc LIMIT ${offset}, ${limit}`, 'users', ['is_active']);
		},
		countUsers({ teamId, q }) {
			const c = [];
			if (teamId) c.push(`team_id = ${lit('id', teamId)}`);
			if (q) c.push(searchCondition(q));
			return db.count(`SELECT COUNT(ROWID) AS total FROM users${c.length ? ` WHERE ${c.join(' AND ')}` : ''}`);
		},
		allUsers: () => db.select(`SELECT ${USER_COLS} FROM users ORDER BY email asc LIMIT 0, ${MAX}`, 'users', ['is_active']),
		activeAdminUsers: () => db.select(`SELECT ROWID, app_role, is_active FROM users WHERE app_role = 'admin' AND is_active = true LIMIT 0, ${MAX}`, 'users', ['is_active']),
		updateUser: (row) => db.update('users', row),
		teamExists: async (id) => (await db.select(`SELECT ROWID FROM teams WHERE ROWID = ${lit('id', id)} LIMIT 0, 1`, 'teams')).length > 0, // teams have no soft delete
	};
}

module.exports = { createAccessRepository };
