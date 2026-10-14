'use strict';

// Guards data/sample-import/*.csv: the files must stay importable through the real import API,
// in the documented order, and must produce the dashboard states they are meant to demonstrate.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildWorld } = require('./helpers/world');

const DIR = path.join(__dirname, '../../../../data/sample-import');

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) {
			if (c === '"' && text[i + 1] === '"') (field += '"', i++);
			else if (c === '"') q = false;
			else field += c;
		} else if (c === '"') q = true;
		else if (c === ',') (row.push(field), (field = ''));
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field || row.length) (row.push(field), rows.push(row));
	const [header, ...body] = rows.filter((r) => r.some((x) => x !== ''));
	return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]]).filter(([, v]) => v !== undefined && v.trim() !== '')));
}

const load = (name) => parseCsv(fs.readFileSync(path.join(DIR, name), 'utf8')).map((data, i) => ({ rowNumber: i + 1, data }));

async function importFile(w, user, module, file, policy = 'update') {
	const job = (await w.api(user, 'POST', '/imports/jobs', { module, fileName: file, fileType: 'csv', conflictPolicy: policy })).body.data.id;
	const rows = load(file);
	const results = [];
	for (let i = 0; i < rows.length; i += 100) {
		const r = await w.api(user, 'POST', `/imports/jobs/${job}/commit`, { rows: rows.slice(i, i + 100) });
		assert.equal(r.status, 200, JSON.stringify(r.body));
		results.push(...r.body.data.rows);
	}
	const done = await w.api(user, 'POST', `/imports/jobs/${job}/complete`, {});
	return { job, results, done: done.body.data, count: rows.length };
}

const ORDER = [
	['employees', '1-employees.csv'],
	['projects', '2-projects.csv'],
	['project_assignments', '3-project-assignments.csv'],
	['time_entries', '4-time-entries.csv'],
	['attendance_records', '5-attendance.csv'],
	['leave_records', '6-leave.csv'],
	['ai_usage_records', '7-ai-usage.csv'],
	['product_items', '8-product-items.csv'],
];

test('every sample file imports cleanly, in order, and is idempotent when imported again', async () => {
	const w = buildWorld();
	for (const [module, file] of ORDER) {
		const r = await importFile(w, w.ids.mgr1, module, file);
		const bad = r.results.filter((x) => x.status !== 'committed');
		assert.deepEqual(bad.map((b) => [b.rowNumber, b.errors.map((e) => `${e.field}:${e.code}`).join()]), [], `${file}`);
		assert.equal(r.done.status, 'completed', file);
		assert.equal(r.done.counts.created, r.count, file);
	}
	const sizes = Object.fromEntries(['employees', 'projects', 'project_assignments', 'time_entries', 'attendance_records', 'leave_records', 'ai_usage_records', 'product_items'].map((t) => [t, w.store.rows(t).length]));
	assert.equal(sizes.employees, 4 + 12); // 4 from the test world + 12 imported
	assert.equal(sizes.time_entries, 84);
	assert.equal(sizes.attendance_records, 150);

	// Re-importing creates nothing new (rows are matched by stable keys).
	for (const [module, file] of ORDER) await importFile(w, w.ids.mgr1, module, file, 'skip');
	for (const t of Object.keys(sizes)) assert.equal(w.store.rows(t).length, sizes[t], `${t} duplicated on re-import`);
});

test('the imported data produces the dashboard states the files are designed to show', async () => {
	const w = buildWorld();
	for (const [module, file] of ORDER) await importFile(w, w.ids.mgr1, module, file);
	const get = async (p) => (await w.api(w.ids.mgr1, 'GET', p)).body.data;
	const range = 'from=2026-09-14&to=2026-10-31';

	const o = await get(`/dashboard/overview?${range}`);
	assert.ok(o.time.billableMinutes > 0 && o.time.nonBillableMinutes > 0);
	assert.ok(o.time.excluded.pending > 0 && o.time.excluded.rejected > 0, 'pending and rejected entries are visible');
	assert.equal(o.time.completeness, 'partial');
	assert.ok(o.attendance.lateCount > 0 && o.attendance.unknownCount > 0);
	assert.equal(o.attendance.completeness, 'partial');
	assert.ok(o.leave.approvedDays >= 18 && o.leave.approvedHours === 4);
	assert.equal(o.leave.missingUnitsCount, 1);
	assert.equal(o.headcount.byStatus.on_leave, 1);
	assert.equal(o.headcount.byStatus.inactive, 1);

	const p = await get(`/dashboard/projects?${range}`);
	// 6 imported projects + the 2 seeded status-less projects of the test world
	assert.deepEqual(p.status.byStatus, { active: 4, on_hold: 1, completed: 1, unknown: 2 });
	const atlas = p.workload.projects.find((x) => x.name === 'Atlas Platform Migration');
	assert.ok(atlas.burnPercent > 100, `Atlas burn ${atlas.burnPercent}% should exceed its estimate`);
	assert.equal(p.workload.projects.find((x) => x.name === 'Helios Analytics').burnPercent, null, 'a project without an estimate has no burn');

	const prod = await get('/dashboard/product');
	assert.equal(prod.product.total, 24);
	assert.ok(prod.product.overdue > 0);

	const ai = await get('/dashboard/ai-usage?from=2026-09-01&to=2026-10-31');
	assert.ok(ai.usage.tools.length >= 4);
	assert.equal(ai.usage.missingPeriod, 1);
	const t = await get('/dashboard/trends?from=2026-09-14&to=2026-10-12&granularity=week');
	assert.ok(t.time.length >= 4 && t.attendance.length >= 2);
});

test('the conflicts-and-errors file demonstrates conflicts, a new row, and three kinds of invalid row', async () => {
	const w = buildWorld();
	await importFile(w, w.ids.mgr1, 'employees', '1-employees.csv');
	const job = (await w.api(w.ids.mgr1, 'POST', '/imports/jobs', { module: 'employees', fileName: '9.csv', conflictPolicy: 'ask' })).body.data.id;
	const p = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/preview`, { rows: load('9-employees-conflicts-and-errors.csv') });
	assert.deepEqual(p.body.data.rows.map((r) => r.status), ['conflict', 'conflict', 'valid', 'invalid', 'invalid', 'invalid']);
	assert.deepEqual(p.body.data.rows.slice(3).map((r) => r.errors[0].field), ['joining_date', 'full_name', 'employment_status']);
	// resolve one conflict as update, one as keep, then commit
	await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/resolve`, { resolutions: [{ rowNumber: 1, resolution: 'update' }, { rowNumber: 2, resolution: 'keep_existing' }] });
	const c = await w.api(w.ids.mgr1, 'POST', `/imports/jobs/${job}/commit`, { rows: load('9-employees-conflicts-and-errors.csv') });
	assert.deepEqual(c.body.data.rows.map((r) => r.outcome), ['updated', 'skipped', 'created', 'invalid', 'invalid', 'invalid']);
	assert.equal(w.store.rows('employees').find((e) => e.employee_code === 'EMP001').job_role, 'Director of Engineering');
	assert.equal(w.store.rows('employees').find((e) => e.employee_code === 'EMP002').job_role, 'Senior Engineer');
});
