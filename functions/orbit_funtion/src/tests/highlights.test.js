'use strict';

// /dashboard/highlights: top performers, best attendance and new joiners for the period, scoped like everything else.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');

const Q = 'from=2026-10-01&to=2026-10-31';
const att = (w, emp, day, late = 'no') => w.store.insert('attendance_records', { employee_id: emp.ROWID, team_id: emp.primary_team_id, attendance_date: day, late_status: late, is_deleted: 'false', dedupe_key: `${emp.ROWID}|${day}` });

test('top performers are ranked by approved hours, best attendance by on-time days, only people with data', async () => {
	const w = buildWorld();
	const [asha, bala, chitra] = w.e;
	w.store.insert('time_entries', timeEntry(w, { employee_id: asha.ROWID, duration_minutes: 90 }));
	w.store.insert('time_entries', timeEntry(w, { employee_id: bala.ROWID, duration_minutes: 300 }));
	w.store.insert('time_entries', timeEntry(w, { employee_id: bala.ROWID, duration_minutes: 60, approval_status: 'pending' })); // not approved: never counts
	att(w, asha, '2026-10-01');
	att(w, asha, '2026-10-02');
	att(w, bala, '2026-10-01');
	att(w, bala, '2026-10-02', 'yes'); // late: not an on-time day
	const r = await w.api(w.ids.admin, 'GET', `/dashboard/highlights?${Q}`);
	assert.equal(r.status, 200);
	const h = r.body.data;
	assert.deepEqual(h.topPerformers.map((p) => [p.name, p.hours]), [['Bala', 5], ['Asha', 1.5]]);
	assert.deepEqual(h.bestAttendance.map((p) => [p.name, p.days]), [['Asha', 2], ['Bala', 1]]);
	assert.ok(!h.topPerformers.some((p) => p.name === chitra.full_name)); // no data, not padded
});

test('new joiners are the last 30 days before the period end, newest first', async () => {
	const w = buildWorld();
	const join = (i, d) => { w.store.rows('employees').find((r) => r.ROWID === w.e[i].ROWID).joining_date = d; };
	join(0, '2026-10-20');
	join(1, '2026-10-28');
	join(2, '2026-06-01');
	const r = await w.api(w.ids.admin, 'GET', `/dashboard/highlights?${Q}`);
	assert.deepEqual(r.body.data.newJoiners.map((p) => p.name), ['Bala', 'Asha']);
	assert.equal(r.body.data.newJoinerDays, 30);
});

test('a manager sees only their team, and nobody gets row values beyond names, roles and counts', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w, { employee_id: w.e[3].ROWID, team_id: w.t2.ROWID, duration_minutes: 600 })); // Dev, other team
	w.store.insert('time_entries', timeEntry(w, { employee_id: w.e[0].ROWID, duration_minutes: 60 }));
	const r = await w.api(w.ids.mgr1, 'GET', `/dashboard/highlights?${Q}`);
	assert.equal(r.status, 200);
	assert.deepEqual(r.body.data.topPerformers.map((p) => p.name), ['Asha']);
	assert.equal(JSON.stringify(r.body).includes('example.com'), false);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/dashboard/highlights?${Q}&team_id=${w.t2.ROWID}`)).status, 403);
});
