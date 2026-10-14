'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const row = (n) => ({ rowNumber: n, data: { item_type: 'bug', title: `Item ${n}`, status: 'open', source_record_id: `PI-${n}` } });

test('a rejected bulk write tells the user why (schema problems name the column), and stays retryable', async () => {
	let fail = true;
	const w = buildWorld({ hooks: { beforeBulkInsert: async (table) => { if (table === 'product_items' && fail) throw new Error('Column not found: priority_level in table product_items'); } } });
	const job = (await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'product_items', fileName: 'p.csv', conflictPolicy: 'update' })).body.data.id;
	const first = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [row(1), row(2)] });
	assert.deepEqual(first.body.data.rows.map((r) => r.status), ['failed', 'failed']);
	assert.match(first.body.data.rows[0].errors[0].message, /data model does not match/);
	assert.match(first.body.data.rows[0].errors[0].message, /Column not found: priority_level/);
	assert.equal(w.store.rows('product_items').length, 0);
	fail = false;
	const retry = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [row(1), row(2)] });
	assert.deepEqual(retry.body.data.rows.map((r) => r.outcome), ['created', 'created']);
});

test('duplicates and throttling are explained without exposing values', async () => {
	const w = buildWorld({ hooks: { beforeBulkInsert: async (table) => { if (table === 'product_items') throw new Error("Duplicate entry 'ann@example.com' for key email"); } } });
	const job = (await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'product_items', fileName: 'p.csv', conflictPolicy: 'update' })).body.data.id;
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [row(1)] });
	assert.match(r.body.data.rows[0].errors[0].message, /same unique value already exists/);
	assert.doesNotMatch(JSON.stringify(r.body), /ann@example\.com/);
	assert.doesNotMatch(JSON.stringify(w.store.rows('import_rows')), /ann@example\.com/);
});
