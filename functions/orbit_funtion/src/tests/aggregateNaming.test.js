'use strict';

// The Data Store may return aggregate columns under the alias OR under the expression text
// ("COUNT(ROWID)"). The app must behave identically either way.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');
const { normalizeAggregates } = require('../config/datastore');

test('normalizeAggregates copies expression-named columns to their alias and never fabricates values', () => {
	const warnings = [];
	const logger = { warn: (m, f) => warnings.push([m, f]) };
	const sql = 'SELECT status, COUNT(ROWID) AS rows_count, SUM(units) AS units FROM t GROUP BY status';
	const out = normalizeAggregates(sql, [{ status: 'a', 'COUNT(ROWID)': '3', 'SUM(units)': '7' }, { status: 'b', rows_count: '1', units: '2' }, { status: 'c' }], logger);
	assert.deepEqual([out[0].rows_count, out[0].units], ['3', '7']);
	assert.deepEqual([out[1].rows_count, out[1].units], ['1', '2']); // alias already present: untouched
	assert.equal(out[2].rows_count, undefined); // nothing to copy: stays missing
	assert.equal(warnings.length, 2);
	assert.equal(warnings[0][0], 'aggregate_alias_missing');
	assert.match(warnings[0][1].gotKeys, /status/);
	assert.doesNotMatch(JSON.stringify(warnings), /"c"/); // keys only, never row values
	assert.equal(normalizeAggregates('SELECT a FROM t', [{ a: 1 }], logger)[0].a, 1);
});

test('list totals, dashboard metrics and import completion work when aggregates come back by expression name', async () => {
	const w = buildWorld({ aggregateKeys: 'expression' });
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 120, is_billable: 'true' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 60, is_billable: 'false' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 30, approval_status: 'pending' }));

	const list = await w.api(w.ids.mgr1, 'GET', '/employees');
	assert.equal(list.body.meta.total, 3);
	assert.equal(list.body.meta.totalPages, 1);

	const o = (await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(o.time.billableMinutes, 120);
	assert.equal(o.time.nonBillableMinutes, 60);
	assert.equal(o.time.excluded.pending, 1);
	assert.equal(o.headcount.total, 3);

	const job = (await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'employees', fileName: 'e.csv', conflictPolicy: 'update' })).body.data.id;
	const rows = [1, 2, 3].map((n) => ({ rowNumber: n, data: { full_name: `P${n}`, employee_code: `X${n}`, email_normalized: `p${n}@example.com` } }));
	const c = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows });
	assert.deepEqual(c.body.data.rows.map((r) => r.outcome), ['created', 'created', 'created']);
	const done = (await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/complete`, {})).body.data;
	assert.equal(done.status, 'completed');
	assert.equal(done.counts.created, 3);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/imports/jobs/${job}`)).body.data.liveCounts.byStatus.committed, 3);
});

test('completing a job with no recorded rows is refused rather than reported as a success', async () => {
	const w = buildWorld();
	const job = (await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'employees', fileName: 'e.csv', conflictPolicy: 'update' })).body.data.id;
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/complete`, {});
	assert.equal(r.status, 409);
	assert.match(r.body.error.message, /No row results were recorded/);
	assert.equal(w.store.rows('import_jobs')[0].status, 'uploaded');
});
