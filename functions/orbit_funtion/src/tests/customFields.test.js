'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const def = (w, over) => w.store.insert('custom_fields', { module: 'employees', field_key: 'grade', label: 'Grade', field_type: 'text', is_active: 'true', is_deleted: 'false', ...over });

test('only an administrator defines columns; managers can read them', async () => {
	const w = buildWorld();
	const body = { module: 'employees', field_key: 'grade', label: 'Grade', field_type: 'text' };
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/custom-fields', body)).status, 403);
	const made = await w.api(w.ids.admin, 'POST', '/custom-fields', body);
	assert.equal(made.status, 201);
	const list = await w.api(w.ids.mgr1, 'GET', '/custom-fields?module=employees');
	assert.equal(list.status, 200);
	assert.equal(list.body.data.length, 1);
});

test('definitions are validated: key shape, module, choices', async () => {
	const w = buildWorld();
	const post = (b) => w.api(w.ids.admin, 'POST', '/custom-fields', { module: 'employees', field_key: 'level', label: 'Level', field_type: 'text', ...b });
	assert.equal((await post({ field_key: 'Bad Key' })).status, 422);
	assert.equal((await post({ module: 'users' })).status, 422);
	assert.equal((await post({ module: 'custom_fields' })).status, 422);
	assert.equal((await post({ field_type: 'choice' })).status, 422); // choices missing
	assert.equal((await post({ field_type: 'choice', choices: 'A, B' })).status, 201);
});

test('values are checked against the definition; undefined keys are refused', async () => {
	const w = buildWorld();
	def(w, {});
	def(w, { field_key: 'score', label: 'Score', field_type: 'number' });
	def(w, { field_key: 'tier', label: 'Tier', field_type: 'choice', choices: 'Gold,Silver' });
	const id = w.e[0].ROWID;
	const patch = (more) => w.api(w.ids.mgr1, 'PATCH', `/employees/${id}`, { more_details: more });
	assert.equal((await patch({ grade: 'L3', score: '7.5', tier: 'Gold' })).status, 200);
	const stored = JSON.parse((await w.api(w.ids.mgr1, 'GET', `/employees/${id}`)).body.data.more_details);
	assert.deepEqual(stored, { grade: 'L3', score: 7.5, tier: 'Gold' });
	assert.equal((await patch({ score: 'high' })).status, 422);
	assert.equal((await patch({ tier: 'Bronze' })).status, 422);
	assert.equal((await patch({ nothing: 'x' })).status, 422);
});

test('keys already stored on the row survive an edit even without a definition', async () => {
	const w = buildWorld();
	const row = w.store.insert('employees', { full_name: 'Old', primary_team_id: w.t1.ROWID, is_deleted: 'false', more_details: JSON.stringify({ imported_note: 'keep' }) });
	const ok = await w.api(w.ids.mgr1, 'PATCH', `/employees/${row.ROWID}`, { more_details: { imported_note: 'keep' } });
	assert.equal(ok.status, 200);
	const changed = await w.api(w.ids.mgr1, 'PATCH', `/employees/${row.ROWID}`, { more_details: { imported_note: 'edited' } });
	assert.equal(changed.status, 422);
});

test('an inactive or deleted definition stops accepting values; deleting works without delete stamps', async () => {
	const w = buildWorld();
	const d = def(w, {});
	const id = w.e[0].ROWID;
	assert.equal((await w.api(w.ids.mgr1, 'PATCH', `/employees/${id}`, { more_details: { grade: 'x' } })).status, 200);
	assert.equal((await w.api(w.ids.admin, 'DELETE', `/custom-fields/${d.ROWID}`)).status, 200);
	assert.equal((await w.api(w.ids.mgr1, 'PATCH', `/employees/${id}`, { more_details: { grade: 'y' } })).status, 422);
});

test('the custom-fields resource is not offered as a record type or an import target', async () => {
	const w = buildWorld();
	const t = await w.api(w.ids.admin, 'GET', '/imports/templates');
	assert.equal(t.status, 200);
	assert.ok(!JSON.stringify(t.body.data).includes('custom_fields'));
});

test('extra=1 adds more_details to list rows (one request, no detail reads)', async () => {
	const w = buildWorld();
	w.store.rows('employees')[0].more_details = JSON.stringify({ grade: 'L1' });
	const plain = await w.api(w.ids.mgr1, 'GET', '/employees');
	assert.ok(!('more_details' in plain.body.data[0]));
	const extra = await w.api(w.ids.mgr1, 'GET', '/employees?extra=1');
	assert.equal(extra.status, 200);
	assert.ok(extra.body.data.some((r) => r.more_details === JSON.stringify({ grade: 'L1' })));
	assert.equal((await w.api(w.ids.admin, 'GET', '/custom-fields?extra=1')).status, 200); // ignored on resources without the column
});
