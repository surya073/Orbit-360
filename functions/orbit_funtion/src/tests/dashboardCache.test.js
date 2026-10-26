'use strict';

// Dashboard aggregates are reused briefly per team scope + filters, so repeat loads cost no Data Store requests.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');

test('a write clears the cache so the next read is fresh', async () => {
	const w = buildWorld();
	const before = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(before.time.approvedEntries, 0);
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 60, is_billable: 'true', approval_status: 'approved' }));
	const stale = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(stale.time.approvedEntries, 0, 'unchanged within the cache window');
	await w.api(w.ids.admin, 'PATCH', `/projects/${w.p[0].ROWID}`, { project_name: 'Alpha 2' });
	const fresh = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(fresh.time.approvedEntries, 1);
});

test('people with different team scopes never share an entry', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 90, is_billable: 'true', approval_status: 'approved' }));
	const all = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	const own = (await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	const other = (await w.api(w.ids.mgr2, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(all.filters.teamId, null);
	assert.equal(own.filters.teamId, w.t1.ROWID);
	assert.equal(other.filters.teamId, w.t2.ROWID);
	assert.equal((await w.api(w.ids.mgr2, 'GET', `/dashboard/overview?from=2026-10-01&to=2026-10-31&team_id=${w.t1.ROWID}`)).status, 403);
});

test('DASHBOARD_CACHE_SECONDS=0 turns it off', async () => {
	const w = buildWorld({ env: { dashboardCacheSeconds: 0 } });
	await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31');
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 60, is_billable: 'true', approval_status: 'approved' }));
	const r = (await w.api(w.ids.admin, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(r.time.approvedEntries, 1);
});
