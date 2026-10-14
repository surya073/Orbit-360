'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const newJob = async (w, user, module) => (await w.api(user, 'POST', '/imports/jobs', { module, fileName: 'x.csv', conflictPolicy: 'update' })).body.data.id;
const commit = (w, user, job, rows) => w.api(user, 'POST', `/imports/jobs/${job}/commit`, { rows });

test('rows can reference employees and projects by business code; codes are never stored', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'time_entries');
	const r = await commit(w, w.ids.mgr1, job, [
		{ rowNumber: 1, data: { employee_code: 'E-Asha', project_code: 'P-Alpha', work_date: '2026-10-05', duration_minutes: 60, is_billable: true, source_record_id: 'T1' } },
		{ rowNumber: 2, data: { employee_code: 'E-Bala', project_code: 'P-Beta', work_date: '2026-10-05', duration_minutes: 30, is_billable: false, source_record_id: 'T2' } },
	]);
	assert.deepEqual(r.body.data.rows.map((x) => x.outcome), ['created', 'created']);
	const [a, b] = w.store.rows('time_entries');
	assert.equal(a.employee_id, w.e[0].ROWID);
	assert.equal(a.project_id, w.p[0].ROWID);
	assert.equal(b.employee_id, w.e[1].ROWID);
	assert.equal(a.team_id, w.t1.ROWID);
	assert.equal(a.employee_code, undefined);
	assert.equal(a.project_code, undefined);
});

test('an unknown code is one clear error on the code column, not a confusing "required" error', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'attendance_records');
	const r = await commit(w, w.ids.mgr1, job, [{ rowNumber: 1, data: { employee_code: 'NOPE', attendance_date: '2026-10-01', late_status: 'no' } }]);
	assert.equal(r.body.data.rows[0].status, 'invalid');
	assert.deepEqual(r.body.data.rows[0].errors.map((e) => [e.field, e.code]), [['employee_code', 'NOT_FOUND']]);
	assert.equal(w.store.rows('attendance_records').length, 0);
});

test('another team\'s code is refused for managers (resolved, then team-checked), allowed for admins', async () => {
	const w = buildWorld();
	const mjob = await newJob(w, w.ids.mgr1, 'attendance_records');
	const m = await commit(w, w.ids.mgr1, mjob, [{ rowNumber: 1, data: { employee_code: 'E-Dev', attendance_date: '2026-10-01', late_status: 'no' } }]);
	assert.equal(m.body.data.rows[0].errors[0].code, 'FORBIDDEN_REFERENCE');
	assert.equal(w.store.rows('attendance_records').length, 0);
	const ajob = await newJob(w, w.ids.admin, 'attendance_records');
	const a = await commit(w, w.ids.admin, ajob, [{ rowNumber: 1, data: { employee_code: 'E-Dev', attendance_date: '2026-10-01', late_status: 'no' } }]);
	assert.equal(a.body.data.rows[0].outcome, 'created');
	assert.equal(w.store.rows('attendance_records')[0].team_id, w.t2.ROWID);
});

test('an explicit id wins over a code; unsafe codes are rejected, not interpolated', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'attendance_records');
	const r = await commit(w, w.ids.mgr1, job, [
		{ rowNumber: 1, data: { employee_id: w.e[2].ROWID, employee_code: 'E-Asha', attendance_date: '2026-10-01', late_status: 'no' } },
		{ rowNumber: 2, data: { employee_code: "x' OR '1'='1", attendance_date: '2026-10-02', late_status: 'no' } },
	]);
	assert.equal(r.body.data.rows[0].outcome, 'created');
	assert.equal(w.store.rows('attendance_records')[0].employee_id, w.e[2].ROWID);
	assert.equal(r.body.data.rows[1].errors[0].message, 'Not a valid code');
});

test('code resolution costs one lookup per table for the whole batch, and re-sending is idempotent', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'time_entries');
	const rows = Array.from({ length: 30 }, (_, i) => ({ rowNumber: i + 1, data: { employee_code: ['E-Asha', 'E-Bala', 'E-Chitra'][i % 3], project_code: i % 2 ? 'P-Alpha' : 'P-Beta', work_date: '2026-10-05', duration_minutes: 10 + i, is_billable: true, source_record_id: `S${i}` } }));
	const before = w.store.queries.length;
	await commit(w, w.ids.mgr1, job, rows);
	const used = w.store.queries.slice(before);
	assert.equal(used.filter((q) => /FROM employees WHERE employee_code IN/.test(q)).length, 1);
	assert.equal(used.filter((q) => /FROM projects WHERE project_code IN/.test(q)).length, 1);
	assert.ok(used.length <= 20, `used ${used.length}`);
	await commit(w, w.ids.mgr1, job, rows);
	assert.equal(w.store.rows('time_entries').length, 30);
});

test('templates advertise the code columns so the UI can offer them', async () => {
	const w = buildWorld();
	const t = (await w.api(w.ids.mgr1, 'GET', '/imports/templates')).body.data;
	assert.deepEqual(t.find((x) => x.module === 'time_entries').importColumns, ['source_record_id', 'employee_code', 'project_code', 'approval_status']);
	assert.deepEqual(t.find((x) => x.module === 'employees').importColumns, ['source_record_id']);
	assert.deepEqual(t.find((x) => x.module === 'project_assignments').importColumns, ['source_record_id', 'employee_code', 'project_code']);
});

test('imported time entries default to pending but may arrive approved (and then count in the dashboard)', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'time_entries');
	const base = { employee_code: 'E-Asha', project_code: 'P-Alpha', work_date: '2026-10-05', duration_minutes: 120, is_billable: true };
	const r = await commit(w, w.ids.mgr1, job, [
		{ rowNumber: 1, data: { ...base, source_record_id: 'A' } },
		{ rowNumber: 2, data: { ...base, source_record_id: 'B', approval_status: 'approved' } },
		{ rowNumber: 3, data: { ...base, source_record_id: 'C', approval_status: 'bogus' } },
	]);
	assert.deepEqual(r.body.data.rows.map((x) => x.status), ['committed', 'committed', 'invalid']);
	const [a, b] = w.store.rows('time_entries');
	assert.equal(a.approval_status, 'pending');
	assert.equal(b.approval_status, 'approved');
	assert.equal(b.approved_by_user_id, '1002'.replace('1002', w.store.rows('users').find((u) => u.catalyst_user_id === '901').ROWID));
	assert.ok(b.approved_at);
	const d = (await w.api(w.ids.mgr1, 'GET', '/dashboard/overview?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(d.time.billableMinutes, 120);
	assert.equal(d.time.excluded.pending, 1);
});
