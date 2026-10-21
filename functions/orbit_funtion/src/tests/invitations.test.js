'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const person = (over = {}) => ({ firstName: 'Nila', lastName: 'Sen', email: 'Nila.Sen@Example.com', roleId: 'manager', teamId: undefined, ...over });

test('an administrator invites a person: Catalyst is asked once, and the user, role and team exist before the first sign-in', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.admin, 'POST', '/access/invitations', person({ teamId: w.t1.ROWID }));
	assert.equal(r.status, 201);
	assert.equal(r.body.data.status, 'invited');
	assert.equal(w.store.invites.length, 1);
	assert.deepEqual({ ...w.store.invites[0].userConfig }, { first_name: 'Nila', last_name: 'Sen', email_id: 'nila.sen@example.com' });
	const user = w.store.rows('users').find((u) => u.email === 'nila.sen@example.com');
	assert.equal(user.catalyst_user_id, w.store.invites[0].user_id);
	assert.equal(user.team_id, w.t1.ROWID);
	assert.equal(user.display_name, 'Nila Sen');
	assert.equal(w.store.rows('user_roles').length, 1);
	// the invited person can now sign in with the Catalyst id Catalyst returned
	const me = await w.api(Number(user.catalyst_user_id), 'GET', '/employees');
	assert.equal(me.status, 200);
});

test('invitations are validated and refuse duplicates, unknown teams and a missing team for a team role', async () => {
	const w = buildWorld();
	const post = (b) => w.api(w.ids.admin, 'POST', '/access/invitations', b);
	assert.equal((await post(person({ email: 'not-an-email', teamId: w.t1.ROWID }))).status, 422);
	assert.equal((await post(person({ firstName: '' , teamId: w.t1.ROWID }))).status, 422);
	assert.equal((await post(person({ roleId: 'owner', teamId: w.t1.ROWID }))).status, 422);
	assert.equal((await post(person())).status, 422); // team role without a team
	assert.equal((await post(person({ teamId: '99999' }))).status, 422);
	assert.equal((await post(person({ email: 'u901@example.com', teamId: w.t1.ROWID }))).status, 409); // already a user
	assert.equal(w.store.invites, undefined); // nothing was sent
	assert.equal((await post(person({ teamId: w.t1.ROWID }))).status, 201);
	assert.equal((await post(person({ teamId: w.t1.ROWID }))).status, 409);
});

test('invite rules: managers invite only into their own team, never an Administrator; the permission is required', async () => {
	const w = buildWorld();
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/access/invitations', person({ teamId: w.t1.ROWID }))).status, 403); // managers lack access.manage_users by default
	await w.api(w.ids.admin, 'PUT', '/access/users/' + w.store.rows('users')[1].ROWID + '/permissions', { allow: ['access.manage_users', 'access.view'] });
	const mgr = (b) => w.api(w.ids.mgr1, 'POST', '/access/invitations', b);
	assert.equal((await mgr(person({ roleId: 'admin' }))).status, 403);
	assert.equal((await mgr(person({ teamId: w.t2.ROWID }))).status, 403);
	// ...and they cannot hand out a role that can do more than they can
	assert.equal((await mgr(person())).status, 201); // team defaults to their own
	assert.equal(w.store.rows('users').find((u) => u.email === 'nila.sen@example.com').team_id, w.t1.ROWID);
});

test('a failed Catalyst invitation creates nothing of ours and says so', async () => {
	const w = buildWorld({ hooks: { registerUser: async () => { throw new Error('boom'); } } });
	const before = w.store.rows('users').length;
	const r = await w.api(w.ids.admin, 'POST', '/access/invitations', person({ teamId: w.t1.ROWID }));
	assert.equal(r.status, 502);
	assert.equal(r.body.error.code, 'INVITE_FAILED');
	assert.equal(w.store.rows('users').length, before);
});

test('individual permissions: allow adds to the role, deny removes from it, and both apply at once', async () => {
	const w = buildWorld();
	const mgr = w.store.rows('users').find((u) => u.catalyst_user_id === '901');
	const delEmp = await w.api(w.ids.mgr1, 'DELETE', `/employees/${w.e[0].ROWID}`);
	assert.equal(delEmp.status, 200); // managers can delete employees by default
	const set = await w.api(w.ids.admin, 'PUT', `/access/users/${mgr.ROWID}/permissions`, { allow: ['access.view'], deny: ['employees.delete'] });
	assert.equal(set.status, 200);
	assert.deepEqual(set.body.data.allow, ['access.view']);
	assert.deepEqual(set.body.data.deny, ['employees.delete']);
	assert.ok(set.body.data.effective.includes('access.view'));
	assert.ok(!set.body.data.effective.includes('employees.delete'));
	// takes effect straight away on this instance
	assert.equal((await w.api(w.ids.mgr1, 'DELETE', `/employees/${w.e[1].ROWID}`)).status, 403);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/access/users')).status, 200);
	const me = await w.api(w.ids.mgr1, 'GET', '/me');
	assert.ok(me.body.data.permissions.includes('access.view'));
	assert.ok(!me.body.data.permissions.includes('employees.delete'));
	// clearing restores the role
	await w.api(w.ids.admin, 'PUT', `/access/users/${mgr.ROWID}/permissions`, { allow: [], deny: [] });
	assert.equal((await w.api(w.ids.mgr1, 'DELETE', `/employees/${w.e[1].ROWID}`)).status, 200);
	const listed = await w.api(w.ids.admin, 'GET', '/access/users');
	assert.equal(listed.body.data.find((u) => u.id === String(mgr.ROWID)).overrideCount, 0);
});

test('individual permission rules: no self-change, none for Administrators, no granting what you lack, no contradictions', async () => {
	const w = buildWorld();
	const users = w.store.rows('users');
	const admin = users.find((u) => u.catalyst_user_id === '900');
	const mgr = users.find((u) => u.catalyst_user_id === '901');
	const put = (who, id, b) => w.api(who, 'PUT', `/access/users/${id}/permissions`, b);
	assert.equal((await put(w.ids.admin, admin.ROWID, { allow: [], deny: ['employees.view'] })).status, 403); // administrator or yourself
	assert.equal((await put(w.ids.admin, mgr.ROWID, { allow: ['employees.view'], deny: ['employees.view'] })).status, 422);
	assert.equal((await put(w.ids.admin, mgr.ROWID, { allow: ['nope.nothing'] })).status, 422);
	// a manager with manage_users cannot allow what they themselves lack
	await put(w.ids.admin, mgr.ROWID, { allow: ['access.manage_users'] });
	const other = users.find((u) => u.catalyst_user_id === '902');
	const t = await put(w.ids.mgr1, other.ROWID, { allow: ['access.manage_roles'] });
	assert.equal(t.status, 404); // a different team: its users are invisible
	const mate = w.store.insert('users', { catalyst_user_id: '950', email: 'mate@example.com', app_role: 'manager', team_id: w.t1.ROWID, is_active: 'true' });
	assert.equal((await put(w.ids.mgr1, mate.ROWID, { allow: ['access.manage_roles'] })).status, 403); // lacks it themselves
	assert.equal((await put(w.ids.mgr1, mate.ROWID, { allow: [], deny: ['employees.delete'] })).status, 200); // taking away is always fine
	const read = await w.api(w.ids.admin, 'GET', `/access/users/${mate.ROWID}/permissions`);
	assert.deepEqual(read.body.data.deny, ['employees.delete']);
	assert.equal(read.body.data.canEdit, true);
	const adminRead = await w.api(w.ids.admin, 'GET', `/access/users/${admin.ROWID}/permissions`);
	assert.equal(adminRead.body.data.locked, true);
});

test('without the user_permissions table roles keep working and saving an override explains why', async () => {
	const w = buildWorld();
	w.store.missing = new Set(['user_permissions']);
	const mgr = w.store.rows('users').find((u) => u.catalyst_user_id === '901');
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/employees')).status, 200);
	const r = await w.api(w.ids.admin, 'PUT', `/access/users/${mgr.ROWID}/permissions`, { allow: ['access.view'] });
	assert.equal(r.status, 409);
	assert.equal(r.body.error.code, 'ACCESS_TABLES_MISSING');
	assert.equal((await w.api(w.ids.admin, 'GET', '/access/users')).status, 200);
});
