'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const put = (w, user, nodes, team) => w.api(user, 'PUT', '/reporting-structure', { ...(team ? { team_id: team } : {}), nodes });

test('reporting structure: empty at first, lists the real team roster only', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.mgr1, 'GET', '/reporting-structure');
	assert.equal(r.status, 200);
	assert.deepEqual(r.body.data.employees.map((e) => e.name), ['Asha', 'Bala', 'Chitra']);
	assert.deepEqual(r.body.data.nodes, []);
	assert.equal(r.body.data.team.name, 'Team 1');
	assert.equal(r.body.data.employees[0].department, 'Team 1');
});

test('reporting structure: save, reload, no duplicate rows on re-save, removal keeps the employee record', async () => {
	const w = buildWorld();
	const [a, b, c] = w.e.map((e) => e.ROWID);
	const tree = [{ employeeId: a, parentId: null, roleLabel: 'Delivery Lead' }, { employeeId: b, parentId: a, roleLabel: 'Developer' }, { employeeId: c, parentId: a, roleLabel: null }];
	const saved = await put(w, w.ids.mgr1, tree);
	assert.equal(saved.status, 200);
	assert.equal(saved.body.data.added, 3);
	const again = await put(w, w.ids.mgr1, tree);
	assert.equal(again.body.data.added, 0);
	assert.equal(again.body.data.changed, 0);
	assert.equal(w.store.rows('application_settings').length, 3);
	const got = await w.api(w.ids.mgr1, 'GET', '/reporting-structure');
	assert.deepEqual(got.body.data.nodes.find((n) => n.employeeId === b), { employeeId: b, parentId: a, roleLabel: 'Developer' });
	// remove c and re-parent b to nobody
	await put(w, w.ids.mgr1, [{ employeeId: a, parentId: null, roleLabel: 'Delivery Lead' }, { employeeId: b, parentId: null, roleLabel: 'Developer' }]);
	const after = await w.api(w.ids.mgr1, 'GET', '/reporting-structure');
	assert.deepEqual(after.body.data.nodes.map((n) => n.employeeId).sort(), [a, b].sort());
	assert.equal(w.store.rows('application_settings').length, 3); // removed node is marked, never duplicated
	assert.equal(w.store.rows('employees').length, 4); // source records untouched
	assert.equal(w.store.rows('employees').find((e) => e.ROWID === b).reports_to_employee_id, undefined);
});

test('reporting structure: rejects self-reporting, cycles, duplicates, missing managers', async () => {
	const w = buildWorld();
	const [a, b, c] = w.e.map((e) => e.ROWID);
	const code = async (nodes) => (await put(w, w.ids.mgr1, nodes)).body.error.details.map((d) => d.code)[0];
	assert.equal(await code([{ employeeId: a, parentId: a }]), 'SELF_REPORT');
	assert.equal(await code([{ employeeId: a, parentId: b }, { employeeId: b, parentId: c }, { employeeId: c, parentId: a }]), 'CIRCULAR');
	assert.equal(await code([{ employeeId: a, parentId: null }, { employeeId: a, parentId: null }]), 'DUPLICATE');
	assert.equal(await code([{ employeeId: a, parentId: b }]), 'MISSING_MANAGER');
	assert.equal(w.store.rows('application_settings').length, 0);
});

test('reporting structure: team boundaries hold for managers and admins', async () => {
	const w = buildWorld();
	const [a, , , d] = w.e.map((e) => e.ROWID);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/reporting-structure?team_id=${w.t2.ROWID}`)).status, 403);
	assert.equal((await put(w, w.ids.mgr1, [{ employeeId: d, parentId: null }])).status, 422); // other team's employee
	assert.equal((await put(w, w.ids.mgr1, [{ employeeId: a, parentId: null }], w.t2.ROWID)).status, 403);
	assert.equal((await w.api(w.ids.admin, 'GET', '/reporting-structure')).status, 400); // admin must choose a team
	assert.equal((await put(w, w.ids.admin, [{ employeeId: d, parentId: null, roleLabel: 'Lead' }], w.t2.ROWID)).status, 200);
	assert.equal((await w.api(w.ids.mgr2, 'GET', '/reporting-structure')).body.data.nodes.length, 1);
	assert.deepEqual((await w.api(w.ids.mgr1, 'GET', '/reporting-structure')).body.data.nodes, []);
	// the generic settings list never exposes tree rows
	assert.equal((await w.api(w.ids.admin, 'GET', '/settings')).body.data.length, 0);
});

test('reporting structure: stale nodes (soft-deleted employees, vanished managers) are dropped on read', async () => {
	const w = buildWorld();
	const [a, b] = w.e.map((e) => e.ROWID);
	await put(w, w.ids.mgr1, [{ employeeId: a, parentId: null }, { employeeId: b, parentId: a }]);
	w.store.rows('employees').find((e) => e.ROWID === a).is_deleted = 'true';
	const got = (await w.api(w.ids.mgr1, 'GET', '/reporting-structure')).body.data;
	assert.deepEqual(got.nodes, [{ employeeId: b, parentId: null, roleLabel: null }]);
});

test('presentations accept the reporting_structure section', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.mgr1, 'POST', '/presentations', { title: 'Deck', period: { preset: 'this_month' }, slides: [{ type: 'section', section: 'reporting_structure' }] });
	assert.equal(r.status, 201);
});
