'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');

const att = (w, e, date, late = 'no', extra = {}) => ({ rowNumber: extra.rowNumber, data: { employee_id: e.ROWID, attendance_date: date, late_status: late, ...extra.data } });
const rowsOf = (list) => list.map((r, i) => ({ rowNumber: r.rowNumber || i + 1, data: r.data }));

async function newJob(w, user, module, extra = {}) {
	const r = await w.api(user, 'POST', '/imports/jobs', { module, fileName: 'x.csv', fileType: 'csv', ...extra });
	assert.equal(r.status, 201, JSON.stringify(r.body));
	return r.body.data.id;
}

test('preview classifies rows without writing business data; row records hold no values', async () => {
	const w = buildWorld();
	w.store.insert('attendance_records', { employee_id: w.e[1].ROWID, team_id: w.t1.ROWID, attendance_date: '2026-10-11', late_status: 'yes', dedupe_key: `${w.e[1].ROWID}|2026-10-11`, is_deleted: 'false' });
	const job = await newJob(w, w.ids.mgr1, 'attendance_records');
	const before = w.store.rows('attendance_records').length;
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/preview`, {
		rows: [
			{ rowNumber: 1, data: { employee_id: w.e[0].ROWID, attendance_date: '2026-10-10', late_status: 'no' } },
			{ rowNumber: 2, data: { employee_id: w.e[0].ROWID, attendance_date: 'SECRET-BAD', late_status: 'SECRETVALUE' } },
			{ rowNumber: 3, data: { employee_id: w.e[1].ROWID, attendance_date: '2026-10-11', late_status: 'no' } },
			{ rowNumber: 4, data: { employee_id: w.e[0].ROWID, attendance_date: '2026-10-10', late_status: 'yes' } },
		],
	});
	assert.equal(r.status, 200);
	assert.deepEqual(r.body.data.rows.map((x) => x.status), ['valid', 'invalid', 'conflict', 'invalid']);
	assert.equal(r.body.data.rows[3].errors[0].code, 'DUPLICATE_IN_BATCH');
	assert.equal(r.body.data.rows[2].conflict.resolution, null);
	assert.equal(w.store.rows('attendance_records').length, before); // nothing written
	const stored = w.store.rows('import_rows');
	assert.equal(stored.length, 4);
	assert.doesNotMatch(JSON.stringify(stored), /SECRETVALUE|SECRET-BAD/); // codes + field names only
	assert.equal(w.store.rows('import_jobs')[0].status, 'validating');
});

test('commit: create, unresolved conflict, resolve=update, complete; re-sending batches never duplicates', async () => {
	const w = buildWorld();
	const existing = w.store.insert('attendance_records', { employee_id: w.e[1].ROWID, team_id: w.t1.ROWID, attendance_date: '2026-10-11', late_status: 'yes', dedupe_key: `${w.e[1].ROWID}|2026-10-11`, is_deleted: 'false' });
	const job = await newJob(w, w.ids.mgr1, 'attendance_records'); // policy: ask
	const batch = [
		{ rowNumber: 1, data: { employee_id: w.e[0].ROWID, attendance_date: '2026-10-10', late_status: 'no' } },
		{ rowNumber: 2, data: { employee_id: w.e[0].ROWID, attendance_date: 'bad', late_status: 'no' } },
		{ rowNumber: 3, data: { employee_id: w.e[1].ROWID, attendance_date: '2026-10-11', late_status: 'no' } },
	];
	await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/preview`, { rows: batch });

	const c1 = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	assert.deepEqual(c1.body.data.rows.map((r) => `${r.status}:${r.outcome}`), ['committed:created', 'invalid:invalid', 'conflict:unresolved_conflict']);
	assert.equal(w.store.rows('attendance_records').length, 2);
	const created = w.store.rows('attendance_records').find((r) => r.attendance_date === '2026-10-10');
	assert.equal(created.team_id, w.t1.ROWID);
	assert.equal(created.reporting_month, '2026-10');
	assert.equal(created.source_system, 'import');
	assert.equal(created.import_job_id, job);
	assert.equal(created.is_deleted, 'false');

	const res = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/resolve`, { resolutions: [{ rowNumber: 3, resolution: 'update' }, { rowNumber: 1, resolution: 'skip' }] });
	assert.deepEqual(res.body.data.results.map((r) => r.ok), [true, false]);
	assert.equal(res.body.data.results[1].code, 'NOT_A_CONFLICT');

	const c2 = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	assert.deepEqual(c2.body.data.rows.map((r) => r.outcome), ['already_committed', 'invalid', 'updated']);
	assert.equal(w.store.rows('attendance_records').length, 2);
	const upd = w.store.rows('attendance_records').find((r) => r.ROWID === existing.ROWID);
	assert.equal(upd.late_status, 'no');
	assert.equal(upd.import_job_id, job);

	// A third and fourth send of the same batch change nothing.
	const snapshot = JSON.stringify(w.store.rows('attendance_records'));
	await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	assert.equal(JSON.stringify(w.store.rows('attendance_records')), snapshot);

	const done = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/complete`, {});
	assert.equal(done.body.data.status, 'completed_with_errors');
	assert.equal(done.body.data.counts.created, 1);
	assert.equal(done.body.data.counts.updated, 1);
	assert.equal(done.body.data.counts.invalid, 1);
	const j = w.store.rows('import_jobs')[0];
	assert.deepEqual([j.created_rows, j.updated_rows, j.invalid_rows, j.status], [1, 1, 1, 'completed_with_errors']);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch })).status, 409); // job is closed
});

test('retry after a lost response (rows written, request failed) does not duplicate', async () => {
	let failOnce = true;
	const w = buildWorld({
		hooks: {
			afterBulkInsert: async (name) => {
				if (name === 'attendance_records' && failOnce) {
					failOnce = false;
					throw new Error('connection reset');
				}
			},
		},
	});
	const job = await newJob(w, w.ids.mgr1, 'attendance_records', { conflictPolicy: 'update' });
	const batch = [{ rowNumber: 1, data: { employee_id: w.e[0].ROWID, attendance_date: '2026-10-10', late_status: 'no' } }, { rowNumber: 2, data: { employee_id: w.e[1].ROWID, attendance_date: '2026-10-10', late_status: 'yes' } }];
	const first = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	assert.deepEqual(first.body.data.rows.map((r) => r.status), ['failed', 'failed']);
	assert.equal(w.store.rows('attendance_records').length, 2); // the writes did land
	const retry = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: batch });
	assert.deepEqual(retry.body.data.rows.map((r) => r.outcome), ['already_applied', 'already_applied']);
	assert.equal(w.store.rows('attendance_records').length, 2);
	assert.deepEqual(w.store.rows('import_rows').map((r) => r.status), ['committed', 'committed']);
});

test('job default policies: keep_existing and skip leave stored records untouched', async () => {
	for (const policy of ['keep_existing', 'skip']) {
		const w = buildWorld();
		const ex = w.store.insert('attendance_records', { employee_id: w.e[1].ROWID, team_id: w.t1.ROWID, attendance_date: '2026-10-11', late_status: 'yes', dedupe_key: `${w.e[1].ROWID}|2026-10-11`, is_deleted: 'false' });
		const job = await newJob(w, w.ids.mgr1, 'attendance_records', { conflictPolicy: policy });
		const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [{ rowNumber: 1, data: { employee_id: w.e[1].ROWID, attendance_date: '2026-10-11', late_status: 'no' } }] });
		assert.equal(r.body.data.rows[0].status, 'skipped');
		assert.equal(w.store.rows('attendance_records').find((x) => x.ROWID === ex.ROWID).late_status, 'yes');
	}
});

test('managers cannot import into, or overwrite, another team; jobs are team-private', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'attendance_records');
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [{ rowNumber: 1, data: { employee_id: w.e[3].ROWID, attendance_date: '2026-10-10', late_status: 'no' } }] });
	assert.equal(r.body.data.rows[0].status, 'invalid');
	assert.equal(r.body.data.rows[0].errors[0].code, 'FORBIDDEN_REFERENCE');
	assert.equal(w.store.rows('attendance_records').length, 0);

	const ejob = await newJob(w, w.ids.mgr1, 'employees', { conflictPolicy: 'update' });
	const clash = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${ejob}/commit`, { rows: [{ rowNumber: 1, data: { full_name: 'Hijack', email_normalized: 'dev@example.com' } }] });
	assert.equal(clash.body.data.rows[0].errors[0].code, 'FORBIDDEN_TARGET');
	assert.equal(w.store.rows('employees').find((e) => e.email_normalized === 'dev@example.com').full_name, 'Dev');

	assert.equal((await w.api(w.ids.mgr2, 'GET', `/imports/jobs/${job}`)).status, 404);
	assert.equal((await w.api(w.ids.mgr2, 'POST', `/imports/jobs/${job}/preview`, { rows: [{ rowNumber: 1, data: {} }] })).status, 404);
	assert.equal((await w.api(w.ids.admin, 'GET', `/imports/jobs/${job}`)).status, 200);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'attendance_records', fileName: 'x.csv', teamId: w.t2.ROWID })).status, 403);
});

test('employees import: stable email key, team forced to the manager\'s team, update on resolve', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'employees', { conflictPolicy: 'update' });
	const a = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [{ rowNumber: 1, data: { full_name: 'Esha', email_normalized: 'Esha@Example.com', primary_team_id: w.t2.ROWID, source_record_id: 'HR-1' } }, { rowNumber: 2, data: { full_name: 'No Key' } }] });
	assert.deepEqual(a.body.data.rows.map((r) => r.status), ['committed', 'invalid']);
	assert.equal(a.body.data.rows[1].errors[0].code, 'MISSING_MATCH_KEY');
	const esha = w.store.rows('employees').find((e) => e.full_name === 'Esha');
	assert.equal(esha.primary_team_id, w.t1.ROWID);
	assert.equal(esha.email_normalized, 'esha@example.com');
	const job2 = await newJob(w, w.ids.mgr1, 'employees', { conflictPolicy: 'update' });
	const b = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job2}/commit`, { rows: [{ rowNumber: 1, data: { full_name: 'Esha K', email_normalized: 'esha@example.com', source_record_id: 'HR-1' } }] });
	assert.equal(b.body.data.rows[0].outcome, 'updated');
	assert.equal(w.store.rows('employees').filter((e) => e.email_normalized === 'esha@example.com').length, 1);
	assert.equal(w.store.rows('employees').find((e) => e.email_normalized === 'esha@example.com').full_name, 'Esha K');
});

test('source_record_id makes time entry imports idempotent across separate jobs', async () => {
	const w = buildWorld();
	const row = (n) => ({ rowNumber: n, data: { employee_id: w.e[0].ROWID, project_id: w.p[0].ROWID, work_date: '2026-10-05', duration_minutes: 60, is_billable: true, source_record_id: `T-${n}` } });
	for (let i = 0; i < 2; i++) {
		const job = await newJob(w, w.ids.mgr1, 'time_entries', { conflictPolicy: 'skip' });
		await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [row(1), row(2)] });
	}
	assert.equal(w.store.rows('time_entries').length, 2);
	assert.deepEqual(w.store.rows('time_entries').map((r) => r.approval_status), ['pending', 'pending']); // imports never self-approve
	const pi = await newJob(w, w.ids.mgr1, 'product_items', { conflictPolicy: 'skip' });
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${pi}/preview`, { rows: [{ rowNumber: 1, data: { item_type: 'bug', title: 'No id' } }] });
	assert.equal(r.body.data.rows[0].errors[0].code, 'MISSING_MATCH_KEY');
});

test('request and batch bounds: batch size, duplicate row numbers, unsupported modules, row paging', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'attendance_records');
	const many = Array.from({ length: 101 }, (_, i) => ({ rowNumber: i + 1, data: {} }));
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/preview`, { rows: many })).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: many })).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [{ rowNumber: 1, data: {} }, { rowNumber: 1, data: {} }] })).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: [] })).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'teams', fileName: 'x.csv' })).status, 422);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'audit_logs', fileName: 'x.csv' })).status, 422);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/imports/jobs/${job}/rows?pageSize=500`)).status, 400);
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/cancel`, {})).body.data.status, 'cancelled');
	assert.equal((await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/preview`, { rows: [{ rowNumber: 1, data: {} }] })).status, 409);
});

test('a full 100-row batch needs a bounded number of Data Store requests (no per-row queries)', async () => {
	const w = buildWorld();
	const job = await newJob(w, w.ids.mgr1, 'attendance_records', { conflictPolicy: 'update' });
	const emps = w.e.slice(0, 3);
	const rows = Array.from({ length: 100 }, (_, i) => ({ rowNumber: i + 1, data: { employee_id: emps[i % 3].ROWID, attendance_date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, late_status: 'no' } }));
	const before = w.store.queries.length;
	const r = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows });
	assert.equal(r.status, 200, JSON.stringify(r.body));
	assert.equal(r.body.data.summary.committed, 100);
	const used = w.store.queries.length - before;
	assert.ok(used <= 20, `used ${used} queries`);
	assert.equal(w.store.rows('attendance_records').length, 100);
	// Re-send: still bounded, nothing duplicated.
	const before2 = w.store.queries.length;
	const again = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows });
	assert.equal(again.body.data.summary.committed, 100);
	assert.ok(w.store.queries.length - before2 <= 12);
	assert.equal(w.store.rows('attendance_records').length, 100);
});

test('re-uploading an identical file is flagged, not blocked', async () => {
	const w = buildWorld();
	const sha = 'a'.repeat(64);
	await newJob(w, w.ids.mgr1, 'attendance_records', { fileSha256: sha });
	const second = await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'attendance_records', fileName: 'x.csv', fileSha256: sha });
	assert.equal(second.status, 201);
	assert.equal(second.body.data.possibleDuplicateOfJobs.length, 1);
});
