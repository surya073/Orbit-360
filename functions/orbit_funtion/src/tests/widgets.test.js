'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld, timeEntry } = require('./helpers/world');

test('project status and workload: top projects only, burn vs lifetime estimate, null when no estimate', async () => {
	const w = buildWorld();
	const [p1, p2] = w.p;
	const row = (id) => w.store.rows('projects').find((p) => p.ROWID === id);
	Object.assign(row(p1.ROWID), { current_status: 'active', estimated_hours: 10 });
	Object.assign(row(p2.ROWID), { current_status: 'on_hold' });
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 300 })); // p1, in range
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 120, work_date: '2026-09-01' })); // p1, before the range: lifetime only
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 60, project_id: p2.ROWID }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 999, approval_status: 'pending' }));
	w.store.insert('time_entries', timeEntry(w, { duration_minutes: 45, project_id: w.p[2].ROWID, team_id: w.t2.ROWID, employee_id: w.e[3].ROWID }));
	const r = await w.api(w.ids.mgr1, 'GET', '/dashboard/projects?from=2026-10-01&to=2026-10-31');
	assert.equal(r.status, 200);
	const d = r.body.data;
	assert.deepEqual(d.status.byStatus, { active: 1, on_hold: 1 });
	assert.deepEqual(d.workload.projects.map((p) => [p.name, p.periodMinutes]), [['Alpha', 300], ['Beta', 60]]);
	assert.equal(d.workload.projects[0].lifetimeMinutes, 420);
	assert.equal(d.workload.projects[0].burnPercent, 70); // 7h of 10h estimated
	assert.equal(d.workload.projects[1].burnPercent, null); // no estimate: not 0
	assert.equal(d.workload.completeness, 'partial');
	assert.equal(d.workload.missing, 'estimate_not_recorded');
	const all = (await w.api(w.ids.admin, 'GET', '/dashboard/projects?from=2026-10-01&to=2026-10-31')).body.data;
	assert.equal(all.workload.projects.length, 3);
	assert.equal((await w.api(w.ids.mgr1, 'GET', `/dashboard/projects?team_id=${w.t2.ROWID}`)).status, 403);
});

test('product status groups by type and status; overdue means open and past due', async () => {
	const w = buildWorld();
	const item = (over) => w.store.insert('product_items', { item_type: 'bug', title: 'x', team_id: w.t1.ROWID, status: 'open', dedupe_key: `k${Math.random()}`, is_deleted: 'false', ...over });
	item({});
	item({ due_date: '2020-01-01' }); // overdue
	item({ due_date: '2020-01-01', completed_date: '2020-01-02', status: 'done' });
	item({ item_type: 'feature', due_date: '2999-01-01' });
	item({ team_id: w.t2.ROWID });
	const d = (await w.api(w.ids.mgr1, 'GET', '/dashboard/product')).body.data.product;
	assert.equal(d.total, 4);
	assert.deepEqual(d.byStatus, { open: 3, done: 1 });
	assert.equal(d.byType.bug.open, 2);
	assert.equal(d.overdue, 1);
	assert.equal((await w.api(w.ids.admin, 'GET', '/dashboard/product')).body.data.product.total, 5);
	assert.equal((await w.api(w.ids.mgr2, 'GET', '/dashboard/product')).body.data.product.total, 1);
});

test('AI usage summary is by tool for the covered months; records without a period are flagged', async () => {
	const w = buildWorld();
	const rec = (over) => w.store.insert('ai_usage_records', { employee_id: w.e[0].ROWID, team_id: w.t1.ROWID, tool_name: 'Copilot', tool_category: 'github', reporting_period: '2026-10', usage_percent_reported: 40, dedupe_key: `k${Math.random()}`, is_deleted: 'false', ...over });
	rec({});
	rec({ usage_percent_reported: 60 });
	rec({ tool_name: 'ChatGPT', tool_category: 'ai', usage_percent_reported: undefined });
	rec({ reporting_period: '2025-01' });
	rec({ reporting_period: undefined });
	const u = (await w.api(w.ids.mgr1, 'GET', '/dashboard/ai-usage?from=2026-10-01&to=2026-10-31')).body.data.usage;
	assert.deepEqual(u.tools.map((t) => [t.tool, t.records, t.avgReportedPercent]), [['Copilot', 2, 50], ['ChatGPT', 1, null]]);
	assert.equal(u.missingPeriod, 1);
	assert.equal(u.completeness, 'partial');
	assert.deepEqual(u.byCategory, { github: 2, ai: 1 });
});

test('data freshness reports the newest source dates for the callers team only', async () => {
	const w = buildWorld();
	w.store.insert('time_entries', timeEntry(w, { work_date: '2026-10-09' }));
	w.store.insert('time_entries', timeEntry(w, { work_date: '2026-10-20', team_id: w.t2.ROWID }));
	w.store.insert('import_jobs', { module: 'attendance_records', team_id: w.t1.ROWID, status: 'completed', finished_at: '2026-10-08 10:00:00' });
	const mine = (await w.api(w.ids.mgr1, 'GET', '/dashboard/freshness')).body.data;
	assert.equal(mine.timeEntries.latestDate, '2026-10-09');
	assert.equal(mine.attendance.latestDate, null);
	assert.equal(mine.imports.lastCompletedAt, '2026-10-08 10:00:00');
	assert.equal((await w.api(w.ids.admin, 'GET', '/dashboard/freshness')).body.data.timeEntries.latestDate, '2026-10-20');
});

test('presentations v2: sections, period and filters; team rules enforced by the backend', async () => {
	const w = buildWorld();
	const body = { title: 'Board', period: { preset: 'last_30_days' }, slides: [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'billable_hours' }] };
	const made = await w.api(w.ids.mgr1, 'POST', '/presentations', { ...body, filters: { project_id: w.p[0].ROWID } });
	assert.equal(made.status, 201);
	const got = (await w.api(w.ids.mgr1, 'GET', `/presentations/${made.body.data.ROWID}`)).body.data;
	assert.equal(got.config.v, 2);
	assert.equal(got.config.period.preset, 'last_30_days');
	assert.equal(got.config.filters.teamId, w.t1.ROWID);
	assert.equal(got.config.filters.projectId, w.p[0].ROWID);
	assert.equal(got.slides[1].section, 'billable_hours');
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/presentations', { ...body, filters: { project_id: w.p[2].ROWID } })).status, 403);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/presentations', { ...body, slides: [{ type: 'section', section: 'nope' }] })).status, 422);
	assert.equal((await w.api(w.ids.mgr1, 'POST', '/presentations', { ...body, period: { preset: 'custom', from: '2026-10-05', to: '2026-10-01' } })).status, 422);
	// a legacy bare-array deck still opens
	w.store.insert('saved_presentations', { title: 'Old', team_id: w.t1.ROWID, slides_config: JSON.stringify([{ type: 'text', body: 'hi' }]), status: 'draft', is_deleted: 'false' });
	const old = (await w.api(w.ids.mgr1, 'GET', '/presentations')).body.data.find((p) => p.title === 'Old');
	const oldFull = (await w.api(w.ids.mgr1, 'GET', `/presentations/${old.ROWID}`)).body.data;
	assert.equal(oldFull.config.v, 1);
	assert.equal(oldFull.slides[0].body, 'hi');
	// editing the period keeps the sections
	assert.equal((await w.api(w.ids.mgr1, 'PATCH', `/presentations/${made.body.data.ROWID}`, { period: { preset: 'this_quarter' } })).status, 200);
	const after = (await w.api(w.ids.mgr1, 'GET', `/presentations/${made.body.data.ROWID}`)).body.data;
	assert.equal(after.config.period.preset, 'this_quarter');
	assert.equal(after.slides.length, 2);
});
