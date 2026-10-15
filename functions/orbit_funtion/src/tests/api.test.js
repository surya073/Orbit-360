'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');

// ---- authentication ----------------------------------------------------------------------
test('health is public; everything else requires a verified, provisioned, active user', async () => {
	const w = buildWorld();
	const { call } = require('./helpers/memoryCatalyst');
	assert.equal((await w.api(null, 'GET', '/health')).status, 200);
	assert.equal((await w.api(null, 'GET', '/employees')).status, 401);
	assert.equal((await w.api(999, 'GET', '/employees')).body.error.code, 'NOT_PROVISIONED');
	assert.equal((await w.api(w.ids.inactive, 'GET', '/employees')).body.error.code, 'ACCOUNT_INACTIVE');
	assert.equal((await w.api(w.ids.noTeam, 'GET', '/employees')).body.error.code, 'MANAGER_TEAM_MISSING');
	assert.ok(call);
});

test('client-supplied role, team or user headers/params cannot elevate access', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.mgr1, 'GET', `/employees?team_id=${w.t2.ROWID}`);
	assert.equal(r.status, 403);
	const me = await w.api(w.ids.mgr1, 'GET', '/me');
	assert.deepEqual([me.body.data.role, me.body.data.teamId], ['manager', w.t1.ROWID]);
});

// ---- team scoping / IDOR -----------------------------------------------------------------
test('managers list only their team; admins see everything', async () => {
	const w = buildWorld();
	const mine = await w.api(w.ids.mgr1, 'GET', '/employees');
	assert.deepEqual(mine.body.data.map((e) => e.full_name).sort(), ['Asha', 'Bala', 'Chitra']);
	assert.equal(mine.body.meta.total, 3);
	assert.equal((await w.api(w.ids.admin, 'GET', '/employees')).body.meta.total, 4);
	assert.equal((await w.api(w.ids.admin, 'GET', `/employees?team_id=${w.t2.ROWID}`)).body.meta.total, 1);
	const teams = await w.api(w.ids.mgr1, 'GET', '/teams');
	assert.deepEqual(teams.body.data.map((t) => t.team_code), ['T1']);
});

test('another team\'s record is a 404 for reads, edits and deletes (no IDOR, no existence leak)', async () => {
	const w = buildWorld();
	const other = w.e[3].ROWID;
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/employees/${other}`)).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'PATCH', `/employees/${other}`, { job_role: 'x' })).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'DELETE', `/employees/${other}`)).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/projects/${w.p[2].ROWID}`)).status, 404);
	assert.equal((await w.api(w.ids.admin, 'GET', `/employees/${other}`)).status, 200);
	assert.equal(w.store.rows('employees').find((e) => e.ROWID === other).job_role, undefined);
});

test('detail reads include more_details; a manager can edit within the team only', async () => {
	const w = buildWorld();
	const id = w.e[0].ROWID;
	const upd = await w.api(w.ids.mgr1, 'PATCH', `/employees/${id}`, { job_role: 'Lead', more_details: { grade: 'L3' } });
	assert.equal(upd.status, 200);
	const got = await w.api(w.ids.mgr1, 'GET', `/employees/${id}`);
	assert.equal(got.body.data.job_role, 'Lead');
	assert.equal(JSON.parse(got.body.data.more_details).grade, 'L3');
	const move = await w.api(w.ids.mgr1, 'PATCH', `/employees/${id}`, { primary_team_id: w.t2.ROWID });
	assert.equal(move.status, 403);
});

test('creating data: team comes from the server, never the client', async () => {
	const w = buildWorld();
	const spoof = await w.api(w.ids.mgr1, 'POST', '/time-entries', { employee_id: w.e[0].ROWID, project_id: w.p[0].ROWID, work_date: '2026-10-05', duration_minutes: 30, is_billable: true, team_id: w.t2.ROWID });
	assert.equal(spoof.status, 422); // team_id is not an accepted field
	const crossProject = await w.api(w.ids.mgr1, 'POST', '/time-entries', { employee_id: w.e[0].ROWID, project_id: w.p[2].ROWID, work_date: '2026-10-05', duration_minutes: 30, is_billable: true });
	assert.equal(crossProject.status, 403);
	const crossEmployee = await w.api(w.ids.mgr1, 'POST', '/time-entries', { employee_id: w.e[3].ROWID, project_id: w.p[0].ROWID, work_date: '2026-10-05', duration_minutes: 30, is_billable: true });
	assert.equal(crossEmployee.status, 403);
	const ok = await w.api(w.ids.mgr1, 'POST', '/time-entries', { employee_id: w.e[0].ROWID, project_id: w.p[0].ROWID, work_date: '2026-10-05', duration_minutes: 30, is_billable: true });
	assert.equal(ok.status, 201);
	const row = w.store.rows('time_entries')[0];
	assert.equal(row.team_id, w.t1.ROWID);
	assert.equal(row.approval_status, 'pending');
	const emp = await w.api(w.ids.mgr1, 'POST', '/employees', { full_name: 'New', primary_team_id: w.t2.ROWID });
	assert.equal(emp.status, 201);
	assert.equal(w.store.rows('employees').find((e) => e.full_name === 'New').primary_team_id, w.t1.ROWID);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/teams', { team_code: 'X', name: 'X' })).status, 403);
	assert.equal((await w.api(w.ids.admin, 'POST', '/teams', { team_code: 'X', name: 'X' })).status, 201);
});

test('duplicate manual records are rejected by the unique key', async () => {
	const w = buildWorld();
	const body = { employee_id: w.e[0].ROWID, attendance_date: '2026-10-05', late_status: 'no' };
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/attendance', body)).status, 201);
	const again = await w.api(w.ids.mgr1, 'POST', '/attendance', body);
	assert.equal(again.status, 409);
	assert.equal(again.body.error.code, 'CONFLICT');
});

test('project assignments are scoped through their project', async () => {
	const w = buildWorld();
	w.store.insert('project_assignments', { project_id: w.p[0].ROWID, employee_id: w.e[0].ROWID, dedupe_key: 'a', is_deleted: 'false' });
	w.store.insert('project_assignments', { project_id: w.p[2].ROWID, employee_id: w.e[3].ROWID, dedupe_key: 'b', is_deleted: 'false' });
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/project-assignments')).status, 400); // project filter required
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/project-assignments?project_id=${w.p[2].ROWID}`)).status, 403);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/project-assignments?project_id=${w.p[0].ROWID}`)).body.meta.total, 1);
	const other = w.store.rows('project_assignments')[1].ROWID;
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/project-assignments/${other}`)).status, 404);
});

test('time entry decisions are team-scoped and edits reset approval', async () => {
	const w = buildWorld();
	const mine = w.store.insert('time_entries', timeEntry(w, { approval_status: 'pending' }));
	const theirs = w.store.insert('time_entries', timeEntry(w, { team_id: w.t2.ROWID, project_id: w.p[2].ROWID, employee_id: w.e[3].ROWID, approval_status: 'pending' }));
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/time-entries/${theirs.ROWID}/decision`, { status: 'approved' })).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/time-entries/${mine.ROWID}/decision`, { status: 'maybe' })).status, 422);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/time-entries/${mine.ROWID}/decision`, { status: 'approved' })).status, 200);
	assert.equal(w.store.rows('time_entries').find((r) => r.ROWID === mine.ROWID).approval_status, 'approved');
	await w.api(w.ids.mgr1, 'PATCH', `/time-entries/${mine.ROWID}`, { duration_minutes: 90 });
	assert.equal(w.store.rows('time_entries').find((r) => r.ROWID === mine.ROWID).approval_status, 'pending');
});

test('writes are audited without personal values', async () => {
	const w = buildWorld();
	await w.api(w.ids.mgr1, 'POST', '/employees', { full_name: 'Audited', email_normalized: 'secret@example.com' });
	const log = w.store.rows('audit_logs')[0];
	assert.equal(log.action, 'create');
	assert.equal(log.entity_table, 'employees');
	assert.match(log.after_json, /"email_normalized":"\[redacted\]"/);
	assert.doesNotMatch(log.after_json, /secret@example\.com/);
});

// ---- dashboard ---------------------------------------------------------------------------
test('billable hours: approved only, split by flag, and never multiplied by headcount or assignments', async () => {
	const w = buildWorld();
	// 3 employees assigned to p1 - must not change any total.
	for (const e of w.e.slice(0, 3)) w.store.insert('project_assignments', { project_id: w.p[0].ROWID, employee_id: e.ROWID, dedupe_key: `as${e.ROWID}`, is_deleted: 'false' });
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 120, is_billable: 'true' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 60, is_billable: 'false', employee_id: w.e[1].ROWID }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 500, is_billable: 'true', approval_status: 'pending' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 30, is_billable: 'true', approval_status: 'rejected' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 45, is_billable: 'true', team_id: w.t2.ROWID, project_id: w.p[2].ROWID, employee_id: w.e[3].ROWID }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 99, is_deleted: 'true' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 77, work_date: '2026-09-30' })); // outside the range

	const q = '/dashboard/overview?from=2026-10-01&to=2026-10-31';
	const m1 = (await w.api(w.ids.mgr1, 'GET', q)).body.data;
	assert.equal(m1.time.billableMinutes, 120);
	assert.equal(m1.time.nonBillableMinutes, 60);
	assert.equal(m1.time.totalMinutes, 180);
	assert.equal(m1.time.approvedEntries, 2);
	assert.deepEqual(m1.time.excluded, { pending: 1, rejected: 1 });
	assert.equal(m1.time.completeness, 'partial');
	assert.equal(m1.filters.teamId, w.t1.ROWID);
	const all = (await w.api(w.ids.admin, 'GET', q)).body.data;
	assert.equal(all.time.billableMinutes, 165); // 120 + 45 from the other team
	const onlyP3 = (await w.api(w.ids.admin, 'GET', `${q}&project_id=${w.p[2].ROWID}`)).body.data;
	assert.equal(onlyP3.time.billableMinutes, 45);
	assert.equal(onlyP3.attendance.completeness, 'not_applicable');
	assert.equal((await w.api(w.ids.mgr1, 'GET', `${q}&team_id=${w.t2.ROWID}`)).status, 403);
});

test('missing attendance and leave data is insufficient_data, not zero', async () => {
	const w = buildWorld();
	const d = (await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(d.time.completeness, 'insufficient_data');
	assert.equal(d.time.billableMinutes, null);
	assert.equal(d.attendance.completeness, 'insufficient_data');
	assert.equal(d.attendance.lateRatePercent, null);
	assert.equal(d.leave.approvedDays, null);
	assert.equal(d.headcount.total, 3);
});

test('late status and leave units are reported as stored; unknown is partial', async () => {
	const w = buildWorld();
	const att = (late, date, e) => w.store.insert('attendance_records', { employee_id: e.ROWID, team_id: w.t1.ROWID, attendance_date: date, late_status: late, dedupe_key: `${e.ROWID}|${date}`, is_deleted: 'false' });
	att('yes', '2026-10-01', w.e[0]);
	att('no', '2026-10-02', w.e[0]);
	att('unknown', '2026-10-03', w.e[0]);
	w.store.insert('leave_records', { employee_id: w.e[1].ROWID, team_id: w.t1.ROWID, leave_type: 'sick', start_date: '2026-10-10', end_date: '2026-10-11', units: 2, unit_type: 'days', status: 'approved', dedupe_key: 'l1', is_deleted: 'false' });
	w.store.insert('leave_records', { employee_id: w.e[1].ROWID, team_id: w.t1.ROWID, leave_type: 'casual', start_date: '2026-10-20', end_date: '2026-10-20', status: 'approved', dedupe_key: 'l2', is_deleted: 'false' });
	const d = (await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(d.attendance.lateRatePercent, 50);
	assert.equal(d.attendance.completeness, 'partial');
	assert.equal(d.leave.approvedDays, 2);
	assert.equal(d.leave.completeness, 'partial');
	assert.equal(d.leave.missingUnitsCount, 1);
});

test('trends: bounded range, grouped queries only, gaps are not zeros', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w, { work_date: '2026-10-05', duration_minutes: 60 }));
	w.store.insert('time_entries', timeEntry(w, { work_date: '2026-10-20', duration_minutes: 30, is_billable: 'false' }));
	const before = w.store.queries.length;
	const r = await w.api(w.ids.mgr1, 'GET', '/dashboard/trends?from=2026-10-01&to=2026-10-31&granularity=week');
	assert.equal(r.status, 200);
	assert.deepEqual(r.body.data.time.map((p) => p.start), ['2026-10-05', '2026-10-19']);
	assert.equal(r.body.data.truncated, false);
	const used = w.store.queries.slice(before).filter((s) => !s.startsWith('SELECT ROWID, catalyst_user_id') && !/FROM (user_roles|roles|role_permissions)/.test(s));
	assert.equal(used.length, 3); // time, pending, attendance - regardless of table size
	assert.ok(used.every((s) => /GROUP BY/.test(s) && /work_date >= '2026-10-01'|attendance_date >= '2026-10-01'/.test(s)));
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/dashboard/trends?from=2026-01-01&to=2026-12-31')).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/dashboard/trends?granularity=hour')).status, 400);
});

test('snapshots are stored once, team-scoped and readable only by the owning team or admins', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w));
	const created = await w.api(w.ids.mgr1, 'POST', '/dashboard/snapshots', { from: '2026-10-01', to: '2026-10-31' });
	assert.equal(created.status, 201);
	const id = created.body.data.ROWID;
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/dashboard/snapshots/${id}`)).body.data.summary.time.billableMinutes, 60);
	assert.equal((await w.api(w.ids.mgr2, 'GET', `/dashboard/snapshots/${id}`)).status, 404);
	assert.equal((await w.api(w.ids.admin, 'GET', `/dashboard/snapshots/${id}`)).status, 200);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/dashboard/snapshots')).body.meta.total, 1);
	assert.equal((await w.api(w.ids.mgr2, 'GET', '/dashboard/snapshots')).body.meta.total, 0);
	assert.equal((await w.api(w.ids.admin, 'GET', '/dashboard/snapshots')).body.meta.total, 1);
});

// ---- presentations -----------------------------------------------------------------------
test('presentations: managers see their team\'s; admins see all including team-less decks', async () => {
	const w = buildWorld();
	const slides = [{ type: 'title', title: 'Q3' }];
	const a = (await w.api(w.ids.mgr1, 'POST', '/presentations', { title: 'T1 deck', slides, team_id: w.t2.ROWID })).body.data.ROWID; // team_id ignored for managers
	const b = (await w.api(w.ids.mgr2, 'POST', '/presentations', { title: 'T2 deck', slides })).body.data.ROWID;
	const c = (await w.api(w.ids.admin, 'POST', '/presentations', { title: 'All hands', slides })).body.data.ROWID;
	assert.deepEqual((await w.api(w.ids.mgr1, 'GET', '/presentations')).body.data.map((p) => p.title), ['T1 deck']);
	assert.equal((await w.api(w.ids.admin, 'GET', '/presentations')).body.meta.total, 3);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/presentations/${b}`)).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/presentations/${c}`)).status, 404); // team-less = admin only
	assert.equal((await w.api(w.ids.mgr1, 'DELETE', `/presentations/${b}`)).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/presentations/${a}`)).body.data.slides[0].title, 'Q3');
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/presentations', { title: 'bad', slides: [{ type: 'snapshot' }] })).status, 422);
});

// ---- runtime safeguards ------------------------------------------------------------------
test('query budget: a request needing too many Data Store calls is stopped, not run up', async () => {
	const w = buildWorld({ env: { queryBudget: 4 } });
	const r = await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31'); // 1 auth + 6 aggregates
	assert.equal(r.status, 503);
	assert.equal(r.body.error.code, 'QUERY_BUDGET_EXCEEDED');
});

test('list endpoints cost one query for a short page, two for a full page, and authentication is cached', async () => {
	const w = buildWorld();
	await w.api(w.ids.mgr1, 'GET', '/employees?pageSize=2&page=2'); // warms the user cache
	let before = w.store.queries.length;
	const short = await w.api(w.ids.mgr1, 'GET', '/employees?pageSize=2&page=2');
	assert.equal(w.store.queries.length - before, 1); // page only: 1 row < pageSize, total derived
	assert.equal(short.body.meta.total, 3);
	before = w.store.queries.length;
	await w.api(w.ids.mgr1, 'GET', '/employees?pageSize=2&page=1');
	assert.equal(w.store.queries.length - before, 2); // full page: page + count
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/employees?pageSize=101')).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/employees?pageSize=2&page=2')).body.data.length, 1);
});

test('slow Data Store calls end in a clean 504 with a request id', async () => {
	const w = buildWorld({ env: { requestTimeoutMs: 40 }, latencyMs: 120 });
	const r = await w.api(w.ids.mgr1, 'GET', '/employees');
	assert.equal(r.status, 504);
	assert.equal(r.body.error.code, 'TIMEOUT');
	assert.ok(r.body.requestId);
});

test('errors never leak internals and always carry a request id', async () => {
	const w = buildWorld();
	const bad = await w.api(w.ids.mgr1, 'POST', '/employees', { full_name: 'x', bogus: 1 });
	assert.equal(bad.status, 422);
	assert.equal(bad.body.ok, false);
	assert.ok(bad.body.requestId);
	assert.equal(bad.body.error.stack, undefined);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/employees/abc')).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/unknown')).status, 404);
	assert.equal((await w.api(w.ids.mgr1, 'PUT', '/employees')).status, 405);
});

test('SDK failure (no Catalyst session context) fails closed with 401, not 500', async () => {
	const { createApp } = require('../app');
	const { call } = require('./helpers/memoryCatalyst');
	const { createLogger } = require('../utils/logger');
	const quiet = createLogger({}, 'error', { log() {}, warn() {}, error() {} });
	const app = createApp({ catalyst: { initialize() { throw new Error('Failed to parse object'); } }, logger: quiet });
	const r = await call(app, { method: 'GET', url: '/api/v1/employees' });
	assert.equal(r.status, 401);
	assert.equal((await call(app, { method: 'GET', url: '/health' })).status, 200);
});

test('500 logs carry stack frames and error class but never the error message (may hold row values)', async () => {
	const { createApp } = require('../app');
	const { call } = require('./helpers/memoryCatalyst');
	const { createLogger } = require('../utils/logger');
	const lines = [];
	const logger = createLogger({}, 'info', { log() {}, warn() {}, error: (l) => lines.push(l) });
	const catalyst = { initialize: (req, o) => (o ? { zcql: () => ({ executeZCQLQuery: async () => { throw new Error('weird failure for ann@example.com'); } }) } : { userManagement: () => ({ getCurrentUser: async () => ({ user_id: '900' }) }) }) };
	const app = createApp({ catalyst, logger });
	const r = await call(app, { method: 'GET', url: '/api/v1/employees', user: 900 });
	assert.equal(r.status, 500);
	assert.equal(r.body.error.message, 'Unexpected server error');
	assert.ok(lines.length >= 1);
	assert.doesNotMatch(lines.join(' | '), /ann@example\.com/);
});

// ---- search by employee / project name on tables without their own name column -------------
test('time entries and attendance are searchable by employee and project name, within the callers team', async () => {
	const w = buildWorld();
	const [asha, bala, , dev] = w.e;
	w.store.insert('time_entries', timeEntry(w, { employee_id: asha.ROWID, work_description: 'a' }));
	w.store.insert('time_entries', timeEntry(w, { employee_id: bala.ROWID, project_id: w.p[1].ROWID }));
	w.store.insert('time_entries', timeEntry(w, { employee_id: dev.ROWID, project_id: w.p[2].ROWID, team_id: w.t2.ROWID }));
	w.store.insert('attendance_records', { employee_id: asha.ROWID, team_id: w.t1.ROWID, attendance_date: '2026-10-05', late_status: 'no', is_deleted: 'false' });

	const byEmployee = await w.api(w.ids.mgr1, 'GET', '/time-entries?q=asha');
	assert.equal(byEmployee.status, 200);
	assert.deepEqual(byEmployee.body.data.map((r) => r.employee_id), [asha.ROWID]);
	const byProject = await w.api(w.ids.mgr1, 'GET', '/time-entries?q=beta');
	assert.deepEqual(byProject.body.data.map((r) => r.employee_id), [bala.ROWID]);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/time-entries?q=dev')).body.data.length, 0); // another team's record stays invisible
	assert.equal((await w.api(w.ids.admin, 'GET', '/time-entries?q=dev')).body.data.length, 1);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/time-entries?q=nobody')).body.data.length, 0);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/attendance?q=asha')).body.data.length, 1);
	assert.equal((await w.api(w.ids.mgr1, 'GET', '/attendance?q=bala')).body.data.length, 0);
});

// ---- text search uses ZCQL wildcards ---------------------------------------------------------
test('list search: partial, any case, trimmed, scoped, paged; clearing restores the full list', async () => {
	const w = buildWorld();
	const names = async (url, who = w.ids.mgr1) => (await w.api(who, 'GET', url)).body.data.map((e) => e.full_name).sort();
	assert.deepEqual(await names('/employees?q=sh'), ['Asha']); // partial match inside the name
	assert.deepEqual(await names('/employees?q=CHIT'), ['Chitra']); // case does not matter
	assert.deepEqual(await names('/employees?q=%20%20bala%20'), ['Bala']); // surrounding spaces are ignored
	assert.deepEqual(await names('/employees?q=dev'), []); // another team's employee is never found by a manager
	assert.deepEqual(await names('/employees?q=dev', w.ids.admin), ['Dev']);
	assert.deepEqual(await names('/employees?q=zzz'), []);
	assert.deepEqual(await names('/employees?q='), ['Asha', 'Bala', 'Chitra']); // an empty query is no filter
	const paged = await w.api(w.ids.mgr1, 'GET', '/employees?q=a&page=2&pageSize=1');
	assert.equal(paged.status, 200);
	assert.equal(paged.body.data.length, 1);
	assert.equal(paged.body.meta.total, 3); // every team-1 name contains an "a"
	// ZCQL's LIKE wildcard is `*`; a `%` would be matched literally and every search would come back empty.
	const sql = w.store.queries.filter((s) => / LIKE /.test(s));
	assert.ok(sql.length > 0);
	assert.ok(sql.every((s) => /LIKE '\*[^']*\*'/.test(s) && !s.includes('%')));
	// a user-typed wildcard is stripped, never passed through
	assert.deepEqual(await names('/employees?q=*'), ['Asha', 'Bala', 'Chitra']);
	assert.deepEqual(await names('/employees?q=%25'), ['Asha', 'Bala', 'Chitra']);
});

test('the test data store treats % literally, like ZCQL (guards against the old LIKE syntax)', () => {
	const w = buildWorld();
	const { condFn } = require('./helpers/memoryCatalyst');
	const run = (cond) => w.store.rows('employees').filter(condFn(cond)).length;
	assert.equal(run("full_name LIKE '%Asha%'"), 0);
	assert.equal(run("full_name LIKE '*Asha*'"), 1);
	assert.equal(run("full_name LIKE 'A?ha'"), 1);
});
