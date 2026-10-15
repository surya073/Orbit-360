'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');
const { routeTable } = require('../routes');
const { authorize } = require('../middleware/authorization');
const { ALL_KEYS, MANAGER_DEFAULT_KEYS, isPermissionKey } = require('../config/permissions');

// buildWorld: catalyst users 900 admin (row 1001), 901 manager of T1 (row 1002), 902 manager of T2 (row 1003).
const A = '900';
const M1 = '901';
const M2 = '902';
const ROW = { admin: '1001', mgr1: '1002', mgr2: '1003' };
const fresh = () => buildWorld({ env: { userCacheSeconds: 0 } }); // tests edit tables directly, so no caching

let counter = 2000;
function addUser(w, { team, role = 'manager', active = true } = {}) {
	counter += 1;
	const row = w.store.insert('users', { catalyst_user_id: String(counter), email: `u${counter}@example.com`, display_name: `User ${counter}`, app_role: role, ...(team ? { team_id: team.ROWID } : {}), is_active: active ? 'true' : 'false' });
	return { cid: String(counter), row: row.ROWID };
}
const body = (r) => r.body.data;
async function makeRole(w, name, permissions, scopeType = 'own_team', as = A) {
	const r = await w.api(as, 'POST', '/access/roles', { name, scopeType, permissions });
	assert.equal(r.status, 201, JSON.stringify(r.body));
	return body(r).id;
}
const assign = (w, userRow, roleId, as = A, extra = {}) => w.api(as, 'PATCH', `/access/users/${userRow}`, { roleId, ...extra });

test('default-deny: every route declares a valid permission, is explicitly open, or is the public health probe', () => {
	for (const r of routeTable) {
		if (r.public) continue;
		const label = `${r.method} ${r.path}`;
		if (r.open) continue;
		const keys = [].concat(r.permission || []);
		assert.ok(keys.length > 0, `${label} declares no permission`);
		for (const k of keys) assert.ok(isPermissionKey(k), `${label} uses unknown permission ${k}`);
	}
	const open = routeTable.filter((r) => r.open && !r.public).map((r) => `${r.method} ${r.path}`);
	assert.deepEqual(open.sort(), ['GET /imports/templates', 'GET /me']);
});

test('default-deny: a route that declares nothing is refused even for an administrator', () => {
	const actor = { role: 'admin', scopeType: 'all_teams', permissions: new Set(ALL_KEYS) };
	assert.throws(() => authorize({ actor }, {}), { code: 'NO_PERMISSION_DECLARED' });
	assert.throws(() => authorize({ actor: { ...actor, permissions: new Set() } }, { permission: 'employees.view' }), { code: 'PERMISSION_DENIED' });
	assert.throws(() => authorize({ actor: { ...actor, permissions: undefined } }, { permission: 'employees.view' }), { code: 'PERMISSION_DENIED' });
	assert.doesNotThrow(() => authorize({ actor }, { permission: ['employees.view', 'dashboard.view'] }));
	assert.throws(() => authorize({ actor: { ...actor, permissions: new Set(['employees.view']) } }, { permission: ['employees.view', 'dashboard.view'] }), { code: 'PERMISSION_DENIED' }); // ALL listed keys are needed
});

test('built-in roles keep the application behaving as before; /me reports the effective permissions', async () => {
	const w = fresh();
	assert.equal((await w.api(M1, 'GET', '/employees')).status, 200);
	assert.equal((await w.api(M1, 'POST', '/employees', { full_name: 'New Person' })).status, 201);
	assert.equal((await w.api(M1, 'POST', '/teams', { team_code: 'T9', name: 'Nine' })).status, 403);
	assert.equal((await w.api(M1, 'GET', '/access/roles')).status, 403);
	assert.equal((await w.api(M1, 'GET', '/access/roles')).body.error.code, 'PERMISSION_DENIED');
	assert.equal((await w.api(A, 'POST', '/teams', { team_code: 'T9', name: 'Nine' })).status, 201);
	const mgr = body(await w.api(M1, 'GET', '/me'));
	assert.deepEqual(mgr.permissions, [...MANAGER_DEFAULT_KEYS].sort());
	assert.equal(mgr.roleKey, 'manager');
	assert.equal(mgr.role, 'manager');
	const adm = body(await w.api(A, 'GET', '/me'));
	assert.equal(adm.permissions.length, ALL_KEYS.length);
	assert.equal(adm.roleKey, 'admin');
});

test('before the access tables exist everything runs on the built-in roles, and changes are refused with a clear message', async () => {
	const w = fresh();
	w.store.missing = new Set(['roles', 'role_permissions', 'user_roles']);
	assert.equal((await w.api(M1, 'GET', '/employees')).status, 200);
	assert.equal((await w.api(M1, 'POST', '/teams', { team_code: 'T9', name: 'Nine' })).status, 403);
	const roles = body(await w.api(A, 'GET', '/access/roles'));
	assert.equal(roles.tablesReady, false);
	assert.deepEqual(roles.roles.map((r) => r.key).sort(), ['admin', 'manager']);
	assert.ok(roles.roles.every((r) => r.source === 'default'));
	const users = await w.api(A, 'GET', '/access/users');
	assert.equal(users.status, 200);
	assert.ok(users.body.data.every((u) => u.roleSource === 'default'));
	const create = await w.api(A, 'POST', '/access/roles', { name: 'Viewer', scopeType: 'own_team', permissions: ['employees.view'] });
	assert.equal(create.status, 409);
	assert.equal(create.body.error.code, 'ACCESS_TABLES_MISSING');
	assert.equal((await assign(w, ROW.mgr1, 'manager')).status, 409);
});

test('a custom role takes effect through the API immediately, and revoking it takes effect just as fast', async () => {
	const w = fresh();
	const viewer = await makeRole(w, 'Employee viewer', ['employees.view', 'dashboard.view']);
	const u = addUser(w, { team: w.t1 });
	assert.equal((await w.api(u.cid, 'GET', '/employees')).status, 200); // legacy manager until assigned
	assert.equal((await assign(w, u.row, viewer)).status, 200);
	const me = body(await w.api(u.cid, 'GET', '/me'));
	assert.deepEqual(me.permissions, ['dashboard.view', 'employees.view']);
	assert.equal(me.roleName, 'Employee viewer');
	assert.equal((await w.api(u.cid, 'GET', '/employees')).body.data.length, 3); // own team only
	assert.equal((await w.api(u.cid, 'GET', '/dashboard/overview')).status, 200);
	for (const [method, url, b] of [['POST', '/employees', { full_name: 'X' }], ['PATCH', `/employees/${w.e[0].ROWID}`, { job_role: 'Y' }], ['GET', '/projects'], ['GET', '/attendance'], ['GET', '/presentations'], ['GET', '/reporting-structure'], ['GET', '/access/roles']]) {
		const r = await w.api(u.cid, method, url, b);
		assert.equal(r.status, 403, `${method} ${url}`);
		assert.equal(r.body.error.code, 'PERMISSION_DENIED');
	}
	// grant Edit -> works at once; revoke -> denied at once
	assert.equal((await w.api(A, 'PUT', `/access/roles/${viewer}/permissions`, { permissions: ['employees.view', 'dashboard.view', 'employees.edit'] })).status, 200);
	assert.equal((await w.api(u.cid, 'PATCH', `/employees/${w.e[0].ROWID}`, { job_role: 'Y' })).status, 200);
	assert.equal((await w.api(A, 'PUT', `/access/roles/${viewer}/permissions`, { permissions: ['employees.view'] })).status, 200);
	assert.equal((await w.api(u.cid, 'PATCH', `/employees/${w.e[0].ROWID}`, { job_role: 'Z' })).status, 403);
	assert.equal((await w.api(u.cid, 'GET', '/dashboard/overview')).status, 403);
	const stored = w.store.rows('role_permissions').filter((r) => r.role_id === viewer);
	assert.equal(stored.length, 3); // revoked rows are kept (is_allowed false), never duplicated
	assert.equal(stored.filter((r) => r.is_allowed === 'true').length, 1);
	const listed = body(await w.api(A, 'GET', '/access/roles')).roles.find((r) => r.id === viewer);
	assert.deepEqual(listed.permissions, ['employees.view']);
	assert.deepEqual(listed.revoked.sort(), ['dashboard.view', 'employees.edit']);
	assert.ok(w.store.rows('audit_logs').some((a) => a.entity_table === 'role_permissions'));
});

test('team boundaries survive custom roles: an own-team role never reaches another team, an all-teams role does', async () => {
	const w = fresh();
	const own = await makeRole(w, 'Team reader', ['employees.view']);
	const wide = await makeRole(w, 'Company reader', ['employees.view'], 'all_teams');
	const u = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, u.row, own)).status, 200);
	assert.equal((await w.api(u.cid, 'GET', `/employees?team_id=${w.t2.ROWID}`)).status, 403);
	assert.equal((await w.api(u.cid, 'GET', `/employees/${w.e[3].ROWID}`)).status, 404); // another team's record: not found, not "forbidden"
	assert.equal((await assign(w, u.row, wide)).status, 200);
	assert.equal((await w.api(u.cid, 'GET', '/employees')).body.data.length, 4);
	assert.equal(w.store.rows('users').find((r) => r.ROWID === u.row).app_role, 'manager'); // only the protected role maps to the legacy "admin"
	// the assignment disappearing must never turn into administrator access: it falls back to a team-bound manager (here: no team -> denied)
	const noTeam = addUser(w, {});
	assert.equal((await assign(w, noTeam.row, wide)).status, 200);
	assert.equal((await w.api(noTeam.cid, 'GET', '/employees')).status, 200);
	w.store.tables.user_roles = [];
	const denied = await w.api(noTeam.cid, 'GET', '/employees');
	assert.equal(denied.status, 403);
	assert.equal(denied.body.error.code, 'MANAGER_TEAM_MISSING');
});

test('a role that needs a team cannot be given to a user without one', async () => {
	const w = fresh();
	const own = await makeRole(w, 'Team reader', ['employees.view']);
	const noTeam = addUser(w, {});
	const r = await assign(w, noTeam.row, own);
	assert.equal(r.status, 422);
	assert.equal(r.body.error.details[0].field, 'teamId');
	assert.equal((await assign(w, noTeam.row, own, A, { teamId: w.t2.ROWID })).status, 200);
	assert.equal((await assign(w, noTeam.row, own, A, { teamId: '999999' })).status, 422);
});

test('time-entry approval, imports and snapshots each need their own permission', async () => {
	const w = fresh();
	const entry = w.store.insert('time_entries', { employee_id: w.e[0].ROWID, project_id: w.p[0].ROWID, team_id: w.t1.ROWID, work_date: '2026-10-05', duration_minutes: 60, is_billable: 'true', approval_status: 'pending', is_deleted: 'false', dedupe_key: 'k1' });
	const maker = await makeRole(w, 'Time editor', ['time_entries.view', 'time_entries.edit', 'imports.view', 'imports.create', 'dashboard.view']);
	const u = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, u.row, maker)).status, 200);
	assert.equal((await w.api(u.cid, 'POST', `/time-entries/${entry.ROWID}/decision`, { status: 'approved' })).status, 403);
	assert.equal((await w.api(M1, 'POST', `/time-entries/${entry.ROWID}/decision`, { status: 'approved' })).status, 200);
	// Imports need the target module's Create permission as well as Imports > Create
	assert.equal((await w.api(u.cid, 'POST', '/imports/jobs', { module: 'time_entries', fileName: 'x.csv', conflictPolicy: 'skip' })).status, 403);
	assert.equal((await w.api(M1, 'POST', '/imports/jobs', { module: 'time_entries', fileName: 'x.csv', conflictPolicy: 'skip' })).status, 201);
	assert.equal((await w.api(u.cid, 'POST', '/dashboard/snapshots', {})).status, 403); // Export, not just View
	assert.equal((await w.api(M1, 'POST', '/dashboard/snapshots', {})).status, 201);
	// field contracts tell the UI what this user may do
	const tpl = body(await w.api(u.cid, 'GET', '/imports/templates')).find((t) => t.module === 'time_entries');
	assert.deepEqual(tpl.permissions, { view: true, create: false, edit: true, delete: false });
	assert.equal(tpl.adminOnly, true);
});

test('privilege escalation is blocked: nobody grants what they lack, widens their own scope, or touches an Administrator', async () => {
	const w = fresh();
	const lead = await makeRole(w, 'Team lead', ['access.view', 'access.manage_users', 'employees.view', 'employees.edit']);
	const reader = await makeRole(w, 'Team reader', ['employees.view']);
	const projects = await makeRole(w, 'Project viewer', ['projects.view', 'employees.view']);
	const wide = await makeRole(w, 'Company reader', ['employees.view'], 'all_teams');
	const boss = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, boss.row, lead)).status, 200);
	const peer = addUser(w, { team: w.t1 });
	const other = addUser(w, { team: w.t2 });

	assert.equal((await assign(w, peer.row, reader, boss.cid)).status, 200); // within their own powers and team
	const e1 = await assign(w, peer.row, projects, boss.cid); // projects.view is not held by the lead
	assert.equal(e1.status, 403);
	assert.equal(e1.body.error.code, 'ESCALATION_DENIED');
	assert.equal((await assign(w, peer.row, wide, boss.cid)).body.error.code, 'ESCALATION_DENIED'); // all-teams scope
	assert.equal((await assign(w, peer.row, 'admin', boss.cid)).body.error.code, 'ESCALATION_DENIED'); // the Administrator role
	assert.equal((await assign(w, boss.row, reader, boss.cid)).body.error.code, 'ESCALATION_DENIED'); // own access
	assert.equal((await assign(w, other.row, reader, boss.cid)).status, 404); // another team's user is invisible
	assert.equal((await assign(w, ROW.admin, reader, boss.cid)).status, 404); // administrators have no team: invisible too
	assert.equal((await w.api(boss.cid, 'PATCH', `/access/users/${peer.row}`, { teamId: w.t2.ROWID })).status, 403); // cannot move people between teams
	const list = await w.api(boss.cid, 'GET', '/access/users');
	assert.deepEqual(list.body.data.map((u2) => u2.id).sort(), [ROW.mgr1, '1004', boss.row, peer.row].sort()); // only their own team (T1 also has the inactive seed user)
	assert.equal((await w.api(boss.cid, 'POST', '/access/roles', { name: 'Anything', scopeType: 'own_team', permissions: [] })).status, 403); // manage_users is not manage_roles
	// an Administrator can only be changed by an Administrator, and never by themselves
	assert.equal((await assign(w, ROW.mgr1, reader, A)).status, 200);
	assert.equal((await assign(w, ROW.admin, reader, A)).body.error.code, 'ESCALATION_DENIED');
	const admin2 = addUser(w, { role: 'admin' });
	assert.equal((await assign(w, admin2.row, reader, boss.cid)).status, 404);
	assert.equal((await w.api(A, 'PATCH', `/access/users/${admin2.row}`, { isActive: false })).status, 200); // an Administrator may
});

test('role management is limited by what the manager holds, and the protected Administrator role cannot be edited', async () => {
	const w = fresh();
	const lead = await makeRole(w, 'Role lead', ['access.view', 'access.manage_roles', 'employees.view', 'employees.edit']);
	const u = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, u.row, lead)).status, 200);
	const mk = (permissions, scopeType = 'own_team', name = 'Child') => w.api(u.cid, 'POST', '/access/roles', { name, scopeType, permissions });
	assert.equal((await mk(['employees.view'], 'own_team', 'Child one')).status, 201);
	assert.equal((await mk(['projects.view'], 'own_team', 'Child two')).body.error.code, 'ESCALATION_DENIED');
	assert.equal((await mk(['employees.view'], 'all_teams', 'Child three')).body.error.code, 'ESCALATION_DENIED');
	assert.equal((await w.api(u.cid, 'PUT', `/access/roles/${lead}/permissions`, { permissions: ALL_KEYS })).body.error.code, 'ESCALATION_DENIED'); // their own role
	for (const who of [A, u.cid]) {
		const put = await w.api(who, 'PUT', '/access/roles/admin/permissions', { permissions: ['dashboard.view'] });
		assert.equal(put.status, 403);
		assert.equal((await w.api(who, 'PATCH', '/access/roles/admin', { name: 'Hacked' })).status, 403);
	}
	assert.equal((await w.api(A, 'PUT', '/access/roles/admin/permissions', { permissions: [] })).body.error.code, 'PROTECTED_ROLE');
	assert.equal((await w.api(A, 'POST', '/access/roles', { name: 'Administrator', scopeType: 'all_teams', permissions: [] })).status, 409); // cannot shadow it
	// the protected role is always complete, whatever is stored
	w.store.insert('roles', { role_key: 'admin', name: 'Administrator', scope_type: 'all_teams', is_system: 'true', is_active: 'true' });
	w.store.tables.role_permissions = [];
	assert.equal(body(await w.api(A, 'GET', '/me')).permissions.length, ALL_KEYS.length);
});

test('editing a built-in role stores it first, copying its defaults, then applies the change', async () => {
	const w = fresh();
	assert.equal(w.store.rows('roles').length, 0);
	const keys = MANAGER_DEFAULT_KEYS.filter((k) => k !== 'employees.delete');
	const r = await w.api(A, 'PUT', '/access/roles/manager/permissions', { permissions: keys });
	assert.equal(r.status, 200);
	assert.equal(r.body.data.revoked, 1);
	assert.equal(w.store.rows('roles').length, 1);
	assert.equal((await w.api(M1, 'DELETE', `/employees/${w.e[0].ROWID}`)).status, 403);
	assert.equal((await w.api(M1, 'GET', '/employees')).status, 200);
	assert.ok(!body(await w.api(M1, 'GET', '/me')).permissions.includes('employees.delete'));
	assert.equal((await w.api(A, 'PUT', '/access/roles/manager/permissions', { permissions: MANAGER_DEFAULT_KEYS })).status, 200); // and back
	assert.equal((await w.api(M1, 'DELETE', `/employees/${w.e[0].ROWID}`)).status, 200);
});

test('anything unclear is denied: inactive roles, unknown scopes, assignments to deleted roles', async () => {
	const w = fresh();
	const id = await makeRole(w, 'Temp role', ['employees.view']);
	const u = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, u.row, id)).status, 200);
	const deactivate = await w.api(A, 'PATCH', `/access/roles/${id}`, { isActive: false });
	assert.equal(deactivate.status, 409); // still assigned
	w.store.rows('roles').find((r) => r.ROWID === id).is_active = 'false'; // e.g. edited in the console
	assert.equal((await w.api(u.cid, 'GET', '/employees')).body.error.code, 'ROLE_INACTIVE');
	w.store.rows('roles').find((r) => r.ROWID === id).is_active = 'true';
	w.store.rows('roles').find((r) => r.ROWID === id).scope_type = 'everything';
	assert.equal((await w.api(u.cid, 'GET', '/employees')).body.error.code, 'INVALID_ROLE');
	w.store.tables.roles = [];
	assert.equal((await w.api(u.cid, 'GET', '/employees')).body.error.code, 'ROLE_MISSING');
	assert.equal((await w.api(u.cid, 'GET', '/me')).status, 403);
	const dead = addUser(w, { team: w.t1, active: false });
	assert.equal((await w.api(dead.cid, 'GET', '/me')).body.error.code, 'ACCOUNT_INACTIVE');
});

test('role and user changes are validated, searchable and audited', async () => {
	const w = fresh();
	assert.equal((await w.api(A, 'POST', '/access/roles', { name: 'X', scopeType: 'own_team' })).status, 422); // too short
	assert.equal((await w.api(A, 'POST', '/access/roles', { name: 'Fine name', scopeType: 'sideways' })).status, 422);
	assert.equal((await w.api(A, 'POST', '/access/roles', { name: 'Fine name', scopeType: 'own_team', permissions: ['employees.fly'] })).status, 422);
	assert.equal((await w.api(A, 'PUT', '/access/roles/notarole/permissions', { permissions: [] })).status, 400);
	assert.equal((await w.api(A, 'PATCH', `/access/users/${ROW.mgr1}`, {})).status, 400);
	assert.equal((await w.api(A, 'PATCH', `/access/users/${ROW.mgr1}`, { isActive: 'yes' })).status, 422);
	const id = await makeRole(w, 'Auditor', ['employees.view']);
	assert.equal((await w.api(A, 'POST', '/access/roles', { name: 'auditor', scopeType: 'own_team', permissions: [] })).status, 409); // names are unique
	assert.equal((await w.api(A, 'PATCH', `/access/roles/${id}`, { name: 'Read-only auditor', description: 'Looks, never touches' })).status, 200);
	const found = await w.api(A, 'GET', '/access/users?q=u900');
	assert.equal(found.status, 200);
	assert.equal(found.body.meta.total, 1);
	assert.equal(found.body.data[0].roleKey, 'admin');
	assert.equal(found.body.data[0].roleSource, 'default');
	const u = addUser(w, { team: w.t1 });
	assert.equal((await assign(w, u.row, id)).status, 200);
	const after = (await w.api(A, 'GET', `/access/users?q=${u.cid}`)).body.data[0];
	assert.equal(after.roleName, 'Read-only auditor');
	assert.equal(after.roleSource, 'assigned');
	assert.equal(w.store.rows('user_roles').filter((r) => r.user_id === u.row).length, 1);
	assert.equal((await assign(w, u.row, 'manager')).status, 200); // re-assigning updates, never duplicates
	assert.equal(w.store.rows('user_roles').filter((r) => r.user_id === u.row).length, 1);
	assert.equal((await w.api(A, 'PATCH', `/access/users/${u.row}`, { isActive: false })).status, 200);
	assert.equal((await w.api(u.cid, 'GET', '/me')).body.error.code, 'ACCOUNT_INACTIVE');
	const trail = w.store.rows('audit_logs').filter((a) => ['roles', 'users', 'role_permissions'].includes(a.entity_table));
	assert.ok(trail.length >= 5);
	assert.ok(trail.every((a) => a.actor_user_id === ROW.admin));
});
