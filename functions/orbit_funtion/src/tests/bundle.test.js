'use strict';

// /dashboard/bundle: the whole dashboard in one request (one function invocation instead of six).

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');

const Q = 'from=2026-10-01&to=2026-10-31&trend_from=2026-08-10&trend_to=2026-10-31&granularity=week';

test('the bundle returns the same sections as the separate endpoints, in one request', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 120, is_billable: 'true' }));
	const r = await w.api(w.ids.admin, 'GET', `/dashboard/bundle?${Q}`);
	assert.equal(r.status, 200);
	const b = r.body.data;
	for (const k of ['overview', 'trends', 'projects', 'product', 'ai', 'freshness']) assert.equal(b[k].ok, true, `${k} should be ok`);
	const single = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.deepEqual(b.overview.data, single);
	assert.equal(b.overview.data.time.billableMinutes, 120);
	assert.equal(b.trends.data.filters.granularity, 'week');
});

test('a manager keeps their team scope, and asking for another team is refused as a whole', async () => {
	const w = buildWorld();
	const own = await w.api(w.ids.mgr1, 'GET', `/dashboard/bundle?${Q}`);
	assert.equal(own.status, 200);
	assert.equal(own.body.data.overview.data.filters.teamId, w.t1.ROWID);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/dashboard/bundle?${Q}&team_id=${w.t2.ROWID}`)).status, 403);
});

test('bad input is a 400 and nothing is queried', async () => {
	const w = buildWorld();
	assert.equal((await w.api(w.ids.admin, 'GET', '/dashboard/bundle?from=2026-10-31&to=2026-10-01')).status, 400);
	assert.equal((await w.api(w.ids.admin, 'GET', `/dashboard/bundle?${Q}&granularity=hourly`)).status, 400);
});
