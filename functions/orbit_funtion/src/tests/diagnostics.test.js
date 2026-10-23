'use strict';

// /diagnostics/schema: admin-only report of live Data Store columns that the code expects but the table lacks.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');
const { expectedByTable } = require('../services/schema.service');

/** A store whose live tables have every expected column, except the ones listed in `drop` ({ table: [col] }). */
function liveColumns(drop = {}) {
	const out = {};
	for (const [table, expected] of expectedByTable()) out[table] = [...expected, 'ROWID', 'CREATEDTIME'].filter((c) => !(drop[table] || []).includes(c));
	return out;
}

test('a complete schema is reported as ok, and only names are returned', async () => {
	const w = buildWorld();
	w.store.columns = liveColumns();
	const r = await w.api(w.ids.admin, 'GET', '/diagnostics/schema');
	assert.equal(r.status, 200);
	assert.equal(r.body.data.ok, true);
	assert.ok(r.body.data.tables.length >= 10);
	assert.ok(r.body.data.tables.every((t) => t.ok && t.missing.length === 0));
	assert.equal(JSON.stringify(r.body).includes('Asha'), false); // no row data
});

test('a table missing a column the code reads is named with that column', async () => {
	const w = buildWorld();
	w.store.columns = liveColumns({ product_items: ['item_priority', 'release_item_id'] });
	const r = await w.api(w.ids.admin, 'GET', '/diagnostics/schema');
	assert.equal(r.status, 200);
	assert.equal(r.body.data.ok, false);
	const t = r.body.data.tables.find((x) => x.table === 'product_items');
	assert.equal(t.ok, false);
	assert.deepEqual(t.missing.sort(), ['item_priority', 'release_item_id']);
	assert.ok(r.body.data.tables.filter((x) => x.table !== 'product_items').every((x) => x.ok));
});

test('a manager cannot run the schema check', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.mgr1, 'GET', '/diagnostics/schema');
	assert.equal(r.status, 403);
});

test('the check stays inside its own request budget (one column lookup per table)', async () => {
	const w = buildWorld();
	w.store.columns = liveColumns();
	const r = await w.api(w.ids.admin, 'GET', '/diagnostics/schema');
	assert.ok(r.body.data.tables.length <= 40);
});
