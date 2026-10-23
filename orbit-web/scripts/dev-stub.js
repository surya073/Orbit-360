/* eslint-disable */
/**
 * Local stand-in for Catalyst + the API, for FRONTEND work only (`npm run start:local`).
 *
 * It signs you in as a test user, serves sample data and accepts every write (nothing is stored).
 * It makes no Catalyst or Data Store requests, so it costs nothing. The real backend and the real
 * sign-in are NOT involved: use `catalyst serve` or the deployed app to test those.
 *
 *   STUB_ROLE=manager npm run start:local    # preview the app as a team manager (default: admin)
 *   STUB_TABLES=0     npm run start:local    # simulate "access tables not created yet"
 */
const http = require('http');
const path = require('path');
const perm = require(path.join(__dirname, '../../functions/orbit_funtion/src/config/permissions.js'));

const PORT = Number(process.env.STUB_PORT || 5055);
const ROLE = process.env.STUB_ROLE === 'manager' ? 'manager' : 'admin';
const TABLES_READY = process.env.STUB_TABLES !== '0';

const ok = (data, meta) => ({ ok: true, data, ...(meta ? { meta } : {}) });
const meta = (n, pageSize = 25) => ({ page: 1, pageSize, total: n, totalPages: Math.max(1, Math.ceil(n / pageSize)) });

const me =
	ROLE === 'admin'
		? { userId: '1', displayName: 'Ari Admin', email: 'ari@example.com', role: 'admin', roleKey: 'admin', roleName: 'Administrator', scopeType: 'all_teams', teamId: null, permissions: [...perm.ALL_KEYS].sort() }
		: { userId: '2', displayName: 'Maya Rao', email: 'maya.rao@example.com', role: 'manager', roleKey: 'manager', roleName: 'Manager', scopeType: 'own_team', teamId: '7', permissions: [...perm.MANAGER_DEFAULT_KEYS].sort() };

const teams = [
	{ ROWID: '7', team_code: 'DEL', name: 'Delivery', description: 'Delivery team', is_active: true },
	{ ROWID: '8', team_code: 'PLT', name: 'Platform', description: 'Platform team', is_active: true },
	{ ROWID: '9', team_code: 'GRW', name: 'Growth', description: 'Marketing, finance and people operations', is_active: true },
];
const people = [
	{ ROWID: '1', full_name: 'Asha Rao', employee_code: 'E-100', job_role: 'Senior Engineer', employment_status: 'active', primary_team_id: '7', joining_date: '2022-03-14', reports_to_employee_id: '2' },
	{ ROWID: '2', full_name: 'Bala Iyer', employee_code: 'E-101', job_role: 'Delivery Lead', employment_status: 'active', primary_team_id: '7', joining_date: '2020-01-06' },
	{ ROWID: '3', full_name: 'Chitra Nair', employee_code: 'E-102', job_role: 'Business Analyst', employment_status: 'on_leave', primary_team_id: '7', joining_date: '2023-07-01', reports_to_employee_id: '2' },
	{ ROWID: '4', full_name: 'Dev Patel', employee_code: 'E-103', job_role: 'QA Engineer', employment_status: 'active', primary_team_id: '8', joining_date: '2021-11-22' },
	{ ROWID: '5', full_name: 'Esha Kumar', employee_code: 'E-104', job_role: 'Backend Engineer', employment_status: 'active', primary_team_id: '8', joining_date: '2021-09-10', reports_to_employee_id: '4' },
	{ ROWID: '6', full_name: 'Farhan Ali', employee_code: 'E-105', job_role: 'DevOps Engineer', employment_status: 'active', primary_team_id: '8', joining_date: '2022-01-15' },
	{ ROWID: '7', full_name: 'Garvit Singh', employee_code: 'E-106', job_role: 'Frontend Engineer', employment_status: 'active', primary_team_id: '7', joining_date: '2023-05-22', reports_to_employee_id: '2' },
	{ ROWID: '8', full_name: 'Harini Desai', employee_code: 'E-107', job_role: 'Product Manager', employment_status: 'active', primary_team_id: '7', joining_date: '2020-11-01' },
	{ ROWID: '9', full_name: 'Iris Wong', employee_code: 'E-108', job_role: 'Marketing Manager', employment_status: 'active', primary_team_id: '9', joining_date: '2022-06-15' },
	{ ROWID: '10', full_name: 'Jatin Patel', employee_code: 'E-109', job_role: 'Finance Analyst', employment_status: 'inactive', primary_team_id: '9', joining_date: '2021-03-08' },
	{ ROWID: '11', full_name: 'Kavya Menon', employee_code: 'E-110', job_role: 'HR Manager', employment_status: 'active', primary_team_id: '9', joining_date: '2019-07-20' },
	{ ROWID: '12', full_name: "Liam O'Brien", employee_code: 'E-111', job_role: 'Senior Engineer', employment_status: 'active', primary_team_id: '8', joining_date: '2020-04-12', reports_to_employee_id: '4' },
];
const projects = [
	{ ROWID: '1', project_name: 'Atlas Platform Migration', project_code: 'PRJ-ATLAS', team_id: '7', current_status: 'active', estimated_hours: 400 },
	{ ROWID: '2', project_name: 'Billing Revamp', project_code: 'PRJ-BILL', team_id: '7', current_status: 'active', estimated_hours: 120 },
	{ ROWID: '3', project_name: 'Customer Portal', project_code: 'PRJ-PORTAL', team_id: '7', current_status: 'active', estimated_hours: null },
	{ ROWID: '4', project_name: 'Data Lake', project_code: 'PRJ-LAKE', team_id: '8', current_status: 'on_hold', estimated_hours: 200 },
	{ ROWID: '5', project_name: 'Mobile App v2', project_code: 'PRJ-MOBILE', team_id: '7', current_status: 'active', estimated_hours: 300 },
	{ ROWID: '6', project_name: 'Security Audit', project_code: 'PRJ-SEC', team_id: '8', current_status: 'active', estimated_hours: 60 },
	{ ROWID: '7', project_name: 'Orion', project_code: 'PRJ-ORION', team_id: '9', current_status: 'completed', estimated_hours: 150 },
];
const tools = [
	{ tool: 'ChatGPT', category: 'ai', records: 4, avgReportedPercent: 33 },
	{ tool: 'Claude', category: 'ai', records: 4, avgReportedPercent: 37 },
	{ tool: 'Figma AI', category: 'other', records: 4, avgReportedPercent: 23 },
	{ tool: 'Cursor', category: 'ai', records: 4, avgReportedPercent: 44 },
	{ tool: 'GitHub Copilot', category: 'github', records: 4, avgReportedPercent: null },
];
const overview = {
	filters: { from: '2026-10-01', to: '2026-10-31', teamId: null, timezone: 'Asia/Kolkata' },
	time: { completeness: 'complete', billableMinutes: 6000, nonBillableMinutes: 2000, totalMinutes: 8000, billablePercent: 75, approvedEntries: 30, excluded: { pending: 0, rejected: 0 } },
	attendance: { completeness: 'complete', lateCount: 3, onTimeCount: 17, unknownCount: 0, lateRatePercent: 15, records: 20 },
	leave: { completeness: 'complete', approvedDays: 3, approvedHours: 0, byStatus: { approved: 2 }, records: 2 },
	headcount: { completeness: 'complete', total: people.length, byStatus: people.reduce((m, e) => ({ ...m, [e.employment_status]: (m[e.employment_status] || 0) + 1 }), {}) },
};
// Field contracts come straight from the backend's resource definitions, so the local preview offers exactly the record types
// (and required fields, allowed values and permissions) the real app does; only the data behind the lists is sample data.
const { resources } = require(path.join(__dirname, '../../functions/orbit_funtion/src/config/resources.js'));
const { importableModules } = require(path.join(__dirname, '../../functions/orbit_funtion/src/validators/imports.validators.js'));
const holds = (key) => ROLE === 'admin' || perm.MANAGER_DEFAULT_KEYS.includes(key);
const templates = Object.values(resources)
	.filter((r) => r.fields && !r.internal)
	.map((r) => {
		const mod = perm.moduleOfResource(r.name);
		const can = (a) => holds(perm.KEY(mod, a));
		return {
			module: r.name,
			importable: importableModules().includes(r.name),
			adminOnly: !can('create'),
			permissions: { view: can('view'), create: can('create'), edit: can('edit'), delete: can('delete') },
			immutable: [],
			importColumns: r.importColumns || ['source_record_id'],
			columns: Object.entries(r.fields).map(([f, spec]) => ({ field: f, type: spec.t, required: Boolean(spec.req), ...(spec.max ? { maxLength: spec.max } : {}), ...(spec.values ? { values: spec.values } : {}) })),
		};
	});

const roles = () => {
	const mk = (id, key, name, desc, scope, perms, extra = {}) => ({ id, key, name, description: desc, scopeType: scope, isSystem: Boolean(extra.system), isProtected: key === 'admin', isActive: true, permissions: perms, revoked: extra.revoked || [], source: extra.source || 'database', userCount: extra.users || 0 });
	return [
		mk('11', 'admin', 'Administrator', perm.DEFAULT_ROLES.admin.description, 'all_teams', perm.ALL_KEYS, { system: true, users: 1 }),
		mk(null, 'manager', 'Manager', perm.DEFAULT_ROLES.manager.description, 'own_team', perm.MANAGER_DEFAULT_KEYS, { system: true, users: 3, source: TABLES_READY ? 'database' : 'default' }),
		mk('21', 'hr_viewer', 'HR viewer', 'Reads people data across the company', 'all_teams', ['employees.view', 'attendance.view', 'leave.view', 'dashboard.view'], { users: 2 }),
	];
};
const accessUsers = [
	{ id: '1', email: 'ari@example.com', displayName: 'Ari Admin', teamId: null, isActive: true, roleId: '11', roleKey: 'admin', roleName: 'Administrator', roleSource: 'default' },
	{ id: '2', email: 'maya.rao@example.com', displayName: 'Maya Rao', teamId: '7', isActive: true, roleId: null, roleKey: 'manager', roleName: 'Manager', roleSource: 'default' },
	{ id: '3', email: 'sam.lee@example.com', displayName: 'Sam Lee', teamId: null, isActive: true, roleId: '21', roleKey: 'hr_viewer', roleName: 'HR viewer', roleSource: 'assigned' },
];
const deckSlides = [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'employee_overview' }, { type: 'section', section: 'ai_usage' }];
const decks = [];
const deck = { ROWID: '5', title: 'Board review', team_id: '7', status: 'ready', slidesAvailable: true, last_presented_at: null, MODIFIEDTIME: '2026-10-10 09:00:00', slides: deckSlides, config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: null, projectId: null }, slides: deckSlides } };
decks.push(deck);
const profile = {
	time: { completeness: 'complete', totalMinutes: 8280, billableMinutes: 6240, nonBillableMinutes: 2040, billablePercent: 75.4 },
	attendance: { completeness: 'complete', lateCount: 3, onTimeCount: 17, records: 20, lateRatePercent: 15 },
	leave: { completeness: 'complete', approvedDays: 2.5, approvedHours: 0, byStatus: { approved: 2 } },
	ai: { completeness: 'complete', tools, toolCount: tools.length },
	product: { completeness: 'complete', total: 9, byStatus: { open: 4, done: 5 }, byType: { bug: { open: 2, done: 1 }, feature: { open: 2, done: 4 } } },
	projects: { total: 2, items: [{ projectId: '1', name: 'Atlas Platform Migration', periodMinutes: 3600 }, { projectId: '2', name: 'Orion', periodMinutes: 2400 }] },
};

// Sample weekly buckets and project workload so the local preview draws real-looking charts.
const WEEKLY = [38, 44, 41, 52, 47, 58, 50, 61, 55, 49, 63, 57, 66];
const trendTime = WEEKLY.map((h, i) => {
	const d = new Date(Date.UTC(2026, 6, 13 + i * 7));
	const billableMinutes = h * 60;
	const nonBillableMinutes = Math.round(h * 60 * (0.25 + (i % 4) * 0.05));
	return { start: d.toISOString().slice(0, 10), completeness: 'complete', billableMinutes, nonBillableMinutes, billablePercent: Math.round((billableMinutes / (billableMinutes + nonBillableMinutes)) * 1000) / 10, approvedEntries: 8 + (i % 5), pendingEntries: i % 3 };
});
const trendAttendance = trendTime.map((b, i) => ({ start: b.start, completeness: 'complete', records: 20, late: 2 + (i % 4), unknown: 0, lateRatePercent: (2 + (i % 4)) * 5 }));
const workload = [
	['1', 'Atlas Platform Migration', 'active', 3600, 400, 14400],
	['2', 'Billing Revamp', 'active', 2400, 120, 8100],
	['3', 'Customer Portal', 'active', 3000, null, 6000],
	['4', 'Data Lake', 'on_hold', 1200, 200, 4200],
	['5', 'Mobile App v2', 'active', 4800, 300, 16200],
	['6', 'Security Audit', 'active', 1800, 60, 4500],
].map(([projectId, name, status, periodMinutes, estimatedHours, lifetimeMinutes]) => ({ projectId, name, status, periodMinutes, entries: Math.round(periodMinutes / 300), estimatedHours, lifetimeMinutes, burnPercent: estimatedHours ? Math.round((lifetimeMinutes / 60 / estimatedHours) * 100) : null })).sort((a, b) => b.periodMinutes - a.periodMinutes);

// ---- sample records for every searchable module. `_emp`/`_project` are search-only helpers: the real API
// matches employee/project names by joining, the stub precomputes them (they are never rendered).
const nameOf = (id) => (people.find((p) => p.ROWID === String(id)) || {}).full_name || '';
const projectName = (id) => (projects.find((p) => p.ROWID === String(id)) || {}).project_name || '';
const day = (d) => `2026-10-${String(d).padStart(2, '0')}`;
const timeEntries = [
	[1, '1', '1', 480, true, 'approved', 'API gateway refactor', 'development'], [2, '2', '1', 360, true, 'approved', 'Sprint planning and review', 'meetings'],
	[3, '3', '7', 240, false, 'approved', 'Requirements workshop', 'analysis'], [5, '4', '3', 450, true, 'approved', 'Regression test suite', 'testing'],
	[6, '5', '3', 420, true, 'pending', 'Rate limiter implementation', 'development'], [7, '6', '6', 300, false, 'approved', 'CI pipeline upgrade', 'devops'],
	[8, '7', '5', 480, true, 'approved', 'Mobile navigation redesign', 'design'], [9, '8', '5', 180, false, 'pending', 'Roadmap grooming', 'planning'],
	[12, '1', '1', 450, true, 'approved', 'Migration scripts', 'development'], [13, '2', '1', 300, true, 'rejected', 'Duplicate entry for review', 'meetings'],
	[14, '9', '2', 360, true, 'approved', 'Billing campaign assets', 'marketing'], [15, '12', '6', 480, true, 'approved', 'Auth service hardening', 'development'],
].map(([d, emp, proj, mins, bill, status, desc, cat], i) => ({ ROWID: String(i + 1), work_date: day(d), employee_id: emp, project_id: proj, duration_minutes: mins, is_billable: bill, work_category: cat, approval_status: status, work_description: desc, _emp: nameOf(emp), _project: projectName(proj) }));
const attendanceRecords = [
	['1', '09:02', 'no', ''], ['2', '08:55', 'no', ''], ['3', '10:21', 'yes', 'Doctor appointment'], ['4', '09:48', 'yes', 'Traffic'], ['5', '09:10', 'no', ''], ['6', '09:35', 'unknown', ''],
	['7', '09:05', 'no', ''], ['8', '10:05', 'yes', 'Client call overran'], ['9', '08:58', 'no', ''], ['10', '09:15', 'no', ''], ['11', '09:00', 'no', ''], ['12', '10:12', 'yes', 'Public transport delay'],
].map(([emp, t, late, why], i) => ({ ROWID: String(i + 1), attendance_date: day(8 + (i % 4)), employee_id: emp, check_in_time_local: t, late_status: late, late_reason: why, _emp: nameOf(emp) }));
const leaveRecords = [
	['3', 'Sick leave', day(5), day(7), 3, 'days', 'approved'], ['1', 'Annual leave', day(19), day(23), 5, 'days', 'requested'], ['5', 'Casual leave', day(2), day(2), 1, 'days', 'approved'],
	['9', 'Annual leave', '2026-09-28', day(1), 4, 'days', 'approved'], ['7', 'Personal leave', day(12), day(12), 4, 'hours', 'rejected'], ['12', 'Casual leave', day(14), day(14), 1, 'days', 'cancelled'],
].map(([emp, type, from, to, units, unit, status], i) => ({ ROWID: String(i + 1), employee_id: emp, leave_type: type, start_date: from, end_date: to, units, unit_type: unit, status, _emp: nameOf(emp) }));
const performanceRecords = [
	['1', 4.5, 'Exceeds expectations', 'finalized'], ['2', 4.2, 'Strong delivery lead', 'finalized'], ['4', 3.8, 'Solid QA coverage', 'submitted'],
	['5', 4.0, 'Reliable backend contributor', 'submitted'], ['7', 3.6, 'Growing quickly', 'draft'], ['12', 4.4, 'Technical mentor', 'finalized'],
].map(([emp, value, text, status], i) => ({ ROWID: String(i + 1), employee_id: emp, review_cycle: 'H1 2026', period_start: '2026-01-01', period_end: '2026-06-30', metric_value: value, metric_text: text, review_status: status, _emp: nameOf(emp) }));
const aiUsageRecords = [
	['1', 'ChatGPT', 'ai', 40, 'Drafting and research'], ['2', 'Claude', 'ai', 35, 'Code review'], ['3', 'GitHub Copilot', 'github', null, 'Code completion'], ['4', 'Cursor', 'ai', 50, 'Refactoring'],
	['5', 'Claude', 'ai', 30, 'Test generation'], ['7', 'Figma AI', 'other', 25, 'Design variations'], ['8', 'ChatGPT', 'ai', 20, 'Roadmap summaries'], ['12', 'GitHub Copilot', 'github', null, 'Pull request summaries'],
].map(([emp, tool, cat, pct, purpose], i) => ({ ROWID: String(i + 1), employee_id: emp, tool_name: tool, tool_category: cat, usage_percent_reported: pct, reporting_period: '2026-09', usage_purpose: purpose, _emp: nameOf(emp) }));
const productItems = [
	['feature', 'API rate limiting', '3', 'open', 'high', '5', day(30)], ['bug', 'Fix search pagination bug', '1', 'open', 'critical', '1', day(10)], ['feature', 'Dark mode theme', '5', 'done', 'medium', '7', null],
	['task', 'Dashboard performance tuning', '1', 'open', 'high', '2', day(9)], ['release', 'Release v2.0', '5', 'open', 'high', '8', day(31)], ['milestone', 'Beta launch', '3', 'open', 'medium', '8', day(25)],
	['bug', 'Login redirect loop', '6', 'done', 'critical', '12', null], ['task', 'Write onboarding guide', '2', 'open', 'low', '9', day(28)],
].map(([type, title, proj, status, priority, assignee, due], i) => ({ ROWID: String(i + 1), item_type: type, title, project_id: proj, status, item_priority: priority, assignee_employee_id: assignee, due_date: due, completed_date: status === 'done' ? day(3) : null }));
const assignments = [
	['1', '1', 'Tech lead', 60], ['1', '2', 'Delivery manager', 40], ['3', '4', 'QA engineer', 100], ['3', '5', 'Backend engineer', 80], ['5', '7', 'Frontend engineer', 100], ['6', '12', 'Security engineer', 50], ['2', '9', 'Campaign owner', 30],
].map(([proj, emp, role, alloc], i) => ({ ROWID: String(i + 1), project_id: proj, employee_id: emp, role_in_project: role, allocation_percent: alloc, is_active: true, start_date: '2026-09-01', end_date: null, _emp: nameOf(emp), _project: projectName(proj) }));

// ---- more sample data (deterministic) so lists, charts, paging and search have something to work with ----
{
	const more = [
		['Mira Joshi', 'UX Designer', 'active', '7', '2023-02-13', '8'], ['Nikhil Rao', 'Backend Engineer', 'active', '8', '2022-08-29', '4'], ['Omar Haddad', 'Data Engineer', 'active', '8', '2021-05-17', '4'],
		['Priya Shah', 'Scrum Master', 'active', '7', '2022-10-03', '2'], ['Quentin Moore', 'Account Manager', 'active', '9', '2020-09-14', '9'], ['Rhea Kapoor', 'QA Analyst', 'active', '8', '2024-01-08', '4'],
		['Sam Okafor', 'Support Lead', 'on_leave', '9', '2021-12-06', '11'], ['Tara Nguyen', 'Frontend Engineer', 'active', '7', '2023-09-18', '7'], ['Uday Verma', 'Solutions Architect', 'active', '8', '2019-11-25', ''],
		['Vera Petrova', 'Product Designer', 'active', '7', '2024-03-04', '8'], ['Waleed Khan', 'Security Engineer', 'active', '8', '2022-04-11', '6'], ['Xena Lopez', 'Recruiter', 'active', '9', '2023-06-19', '11'],
		['Yusuf Demir', 'Mobile Engineer', 'active', '7', '2022-02-21', '7'], ['Zoya Fernandes', 'Business Analyst', 'inactive', '9', '2020-06-01', '9'],
	];
	more.forEach(([full_name, job_role, employment_status, primary_team_id, joining_date, boss], i) => {
		const id = String(people.length + 1);
		people.push({ ROWID: id, full_name, employee_code: 'E-' + (112 + i), job_role, employment_status, primary_team_id, joining_date, ...(boss ? { reports_to_employee_id: boss } : {}) });
	});
	[['Nova CRM Integration', 'PRJ-NOVA', '7', 'active', 220], ['Analytics Warehouse', 'PRJ-WH', '8', 'active', 340], ['Brand Refresh', 'PRJ-BRAND', '9', 'completed', 90]].forEach(([project_name, project_code, team_id, current_status, estimated_hours], i) => {
		projects.push({ ROWID: String(projects.length + 1), project_name, project_code, team_id, current_status, estimated_hours });
	});
	const cats = ['development', 'testing', 'meetings', 'design', 'analysis', 'devops'];
	for (let i = 0; i < 40; i++) {
		const emp = String((i * 7) % people.length + 1);
		const proj = String((i * 3) % projects.length + 1);
		const d = 1 + (i % 28);
		timeEntries.push({ ROWID: String(timeEntries.length + 1), work_date: day(d), employee_id: emp, project_id: proj, duration_minutes: 120 + ((i * 45) % 360), is_billable: i % 4 !== 0, work_category: cats[i % cats.length], approval_status: i % 9 === 0 ? 'pending' : i % 13 === 0 ? 'rejected' : 'approved', work_description: 'Sample work item ' + (i + 1), _emp: nameOf(emp), _project: projectName(proj) });
	}
	for (let i = 0; i < 24; i++) {
		const emp = String((i * 5) % people.length + 1);
		const late = i % 5 === 0 ? 'yes' : i % 11 === 0 ? 'unknown' : 'no';
		attendanceRecords.push({ ROWID: String(attendanceRecords.length + 1), attendance_date: day(1 + (i % 12)), employee_id: emp, check_in_time_local: late === 'yes' ? '10:' + String(5 + (i % 40)).padStart(2, '0') : '09:' + String(i % 30).padStart(2, '0'), late_status: late, late_reason: late === 'yes' ? 'Sample delay' : '', _emp: nameOf(emp) });
	}
	['Annual leave', 'Sick leave', 'Casual leave', 'Personal leave'].forEach((type, i) => {
		const emp = String(14 + i);
		leaveRecords.push({ ROWID: String(leaveRecords.length + 1), employee_id: emp, leave_type: type, start_date: day(6 + i * 4), end_date: day(7 + i * 4), units: 2, unit_type: 'days', status: i === 2 ? 'requested' : 'approved', _emp: nameOf(emp) });
	});
	[['6', 4.1], ['8', 4.6], ['9', 3.9], ['11', 4.3], ['14', 3.7], ['16', 4.8]].forEach(([emp, value]) => {
		performanceRecords.push({ ROWID: String(performanceRecords.length + 1), employee_id: emp, review_cycle: 'H1 2026', period_start: '2026-01-01', period_end: '2026-06-30', metric_value: value, metric_text: 'Sample review note', review_status: value > 4.2 ? 'finalized' : 'submitted', _emp: nameOf(emp) });
	});
	[['15', 'Claude', 'ai', 45, 'Data pipeline review'], ['17', 'Cursor', 'ai', 55, 'Refactoring'], ['19', 'GitHub Copilot', 'github', null, 'Mobile screens'], ['21', 'ChatGPT', 'ai', 30, 'Policy drafting']].forEach(([emp, tool, cat, pct, purpose]) => {
		aiUsageRecords.push({ ROWID: String(aiUsageRecords.length + 1), employee_id: emp, tool_name: tool, tool_category: cat, usage_percent_reported: pct, reporting_period: '2026-09', usage_purpose: purpose, _emp: nameOf(emp) });
	});
}

// Invitations and per-person permissions are kept in memory while the preview runs.
const userOverrides = { 2: { allow: [], deny: [] }, 3: { allow: ["spreadsheet.export"], deny: [] } };
const overridesOf = (id) => userOverrides[id] || (userOverrides[id] = { allow: [], deny: [] });
const accessOfUser = (u) => {
	const role = roles().find((r) => r.key === u.roleKey);
	const o = overridesOf(u.id);
	const locked = u.roleKey === "admin";
	return { user: { id: u.id, email: u.email, displayName: u.displayName }, role: { id: role.id, key: role.key, name: role.name }, rolePermissions: role.permissions, allow: o.allow, deny: o.deny, effective: locked ? perm.ALL_KEYS : [...new Set([...role.permissions, ...o.allow])].filter((k) => !o.deny.includes(k)), locked, canEdit: !locked && u.id !== "1" };
};

// Extra columns: kept in memory while the preview runs so adding/removing one can be tried out.
let customSeq = 3;
const customFields = [{ ROWID: "1", module: "employees", field_key: "client_tier", label: "Client tier", field_type: "choice", choices: "Gold,Silver,Bronze", sort_order: 1, is_active: true }, { ROWID: "2", module: "employees", field_key: "notes", label: "Notes", field_type: "text", sort_order: 2, is_active: true }];
const extraOf = (e) => JSON.stringify(e.ROWID === "1" ? { client_tier: "Gold", notes: "Mentor" } : e.ROWID === "2" ? { client_tier: "Silver" } : {});

function route(method, p, url, body) {
	// Import wizard: a job, then batches checked in memory (rows without a name are invalid). Nothing is stored.
	if (p === '/imports/jobs' && method === 'POST') return { status: 201, body: ok({ id: 'J1', batchSize: 100, status: 'previewing', possibleDuplicateOfJobs: [] }) };
	if (/^\/imports\/jobs\/[^/]+\/preview$/.test(p) && method === 'POST') {
		const rows = (body.rows || []).map((r) => (String((r.data || {}).full_name || '').trim() ? { rowNumber: r.rowNumber, status: 'valid', errors: [] } : { rowNumber: r.rowNumber, status: 'invalid', errors: [{ field: 'full_name', message: 'Required' }] }));
		return { body: ok({ rows }) };
	}
	if (/^\/imports\/jobs\/[^/]+\/commit$/.test(p) && method === 'POST') return { body: ok({ rows: (body.rows || []).map((r) => ({ rowNumber: r.rowNumber, status: String((r.data || {}).full_name || '').trim() ? 'committed' : 'invalid', outcome: 'created', errors: [] })) }) };
	if (/^\/imports\/jobs\/[^/]+\/(resolve|cancel)$/.test(p) && method === 'POST') return { body: ok({ ok: true }) };
	if (/^\/imports\/jobs\/[^/]+\/complete$/.test(p) && method === 'POST') return { body: ok({ status: 'completed', counts: { created: 2, updated: 0, skipped: 0, invalid: 1, conflict: 0 } }) };
	if (p === '/access/invitations' && method === 'POST') {
		const role = roles().find((r) => String(r.id) === String(body.roleId) || r.key === body.roleId);
		const id = String(accessUsers.length + 1);
		accessUsers.push({ id, email: String(body.email).toLowerCase(), displayName: `${body.firstName} ${body.lastName}`, teamId: body.teamId || null, isActive: true, roleId: role ? role.id : null, roleKey: role ? role.key : 'manager', roleName: role ? role.name : 'Manager', roleSource: 'assigned' });
		return { status: 201, body: ok({ id, email: body.email, status: 'invited' }) };
	}
	const permMatch = /^\/access\/users\/(\d+)\/permissions$/.exec(p);
	if (permMatch) {
		const u = accessUsers.find((x) => x.id === permMatch[1]);
		if (!u) return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } } };
		if (method === 'PUT') userOverrides[u.id] = { allow: body.allow || [], deny: body.deny || [] };
		return { body: ok(accessOfUser(u)) };
	}
	if (p === '/custom-fields' && method === 'POST') {
		customFields.push({ ...body, ROWID: String(customSeq++), is_active: true });
		return { status: 201, body: ok({ ROWID: String(customSeq - 1) }) };
	}
	if (/^\/custom-fields\/\d+$/.test(p) && method === 'DELETE') {
		const i = customFields.findIndex((c) => `/custom-fields/${c.ROWID}` === p);
		if (i >= 0) customFields.splice(i, 1);
		return { body: ok({ deleted: true }) };
	}
	// Presentations are kept in memory so the studio can be tried end to end (create, edit, present, duplicate, delete) without Catalyst.
	if (p === '/presentations' && method === 'POST') {
		const id = String(100 + decks.length + 1);
		const row = { ROWID: id, title: body.title, team_id: body.team_id || null, status: body.status || 'draft', last_presented_at: null, MODIFIEDTIME: '2026-10-22 09:00:00', slidesAvailable: true, slides: body.slides, config: { v: 2, period: body.period || { preset: 'this_month' }, filters: { teamId: body.team_id || null, projectId: (body.filters || {}).project_id || null }, slides: body.slides } };
		decks.push(row);
		return { status: 201, body: ok({ ROWID: id }) };
	}
	const deckMatch = /^\/presentations\/(\d+)(\/presented)?$/.exec(p);
	if (deckMatch && method !== 'GET') {
		const d = decks.find((x) => x.ROWID === deckMatch[1]);
		if (!d) return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } } };
		if (method === 'DELETE') decks.splice(decks.indexOf(d), 1);
		else if (method === 'PATCH') {
			if (body.title) d.title = body.title;
			if (body.status) d.status = body.status;
			if (body.slides) {
				d.slides = body.slides;
				d.config = { ...d.config, slides: body.slides, period: body.period || d.config.period };
			}
		}
		return { body: ok({ ROWID: d.ROWID, deleted: method === 'DELETE' || undefined }) };
	}
	if (method !== 'GET') return { status: method === 'POST' ? 201 : 200, body: ok({ ROWID: '999', id: '999', key: 'new_role', granted: 0, revoked: 0 }) };
	const sp = url.searchParams;
	const page = Math.max(1, Number(sp.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
	// One page of rows with accurate totals, so pagination and page-size controls work locally.
	const list = (rows) => ({ body: ok(rows.slice((page - 1) * pageSize, page * pageSize), { ...meta(rows.length, pageSize), page }) });
	const NOT_FILTERS = new Set(['page', 'pageSize', 'q', 'from', 'to', 'ids', 'employee_ids']);
	// Mirrors the real list endpoints: `ids` lookups, exact-match column filters, date range, then text search over `fields`.
	const query = (rows, fields) => {
		let out = rows;
		const ids = (sp.get('ids') || '').split(',').filter(Boolean);
		if (ids.length) out = out.filter((r) => ids.includes(String(r.ROWID)));
		for (const [k, v] of sp.entries()) {
			if (NOT_FILTERS.has(k) || v === '' || !rows.length || !(k in rows[0])) continue;
			out = out.filter((r) => String(r[k]) === v);
		}
		const dateKey = rows.length ? ['work_date', 'attendance_date', 'start_date', 'period_start'].find((d) => d in rows[0]) : null;
		if (dateKey && sp.get('from')) out = out.filter((r) => r[dateKey] >= sp.get('from'));
		if (dateKey && sp.get('to')) out = out.filter((r) => r[dateKey] <= sp.get('to'));
		const q = (sp.get('q') || '').toLowerCase().trim();
		return q ? out.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))) : out;
	};
	switch (true) {
		case p === '/me': return { body: ok(me) };
		case p === '/dashboard/bundle': {
			// the whole dashboard in one request, composed from the single-section answers above
			const part = (path) => ({ ok: true, data: route(method, path, url).body.data });
			return { body: ok({ overview: part('/dashboard/overview'), trends: part('/dashboard/trends'), projects: part('/dashboard/projects'), product: part('/dashboard/product'), ai: part('/dashboard/ai-usage'), freshness: part('/dashboard/freshness'), highlights: part('/dashboard/highlights') }) };
		}
		case p === '/dashboard/overview': return { body: ok(overview) };
		case p === '/dashboard/trends': return { body: ok({ filters: { granularity: 'week' }, truncated: false, time: trendTime, attendance: trendAttendance }) };
		case p === '/dashboard/projects': return { body: ok({ filters: {}, status: { completeness: 'complete', total: 7, byStatus: { active: 5, on_hold: 1, completed: 1 } }, workload: { completeness: 'complete', projectsWithTime: workload.length, truncated: false, projects: workload } }) };
		case p === '/dashboard/product': return { body: ok({ asOf: '2026-10-13', product: { completeness: 'complete', total: 9, byStatus: { open: 4, done: 5 }, byType: { bug: { open: 2, done: 1 }, feature: { open: 2, done: 4 } }, overdue: 2 } }) };
		case p === '/dashboard/ai-usage': return { body: ok({ usage: { completeness: 'complete', totalRecords: 20, toolCount: 5, byCategory: { ai: 12, other: 4, github: 4 }, missingPeriod: 0, tools } }) };
		case p === '/dashboard/highlights': return { body: ok({ filters: {}, topPerformers: [{ id: '1', name: 'Asha Rao', role: 'Engineer', hours: 42.5 }, { id: '2', name: 'Bala Kumar', role: 'Designer', hours: 38 }, { id: '3', name: 'Chitra Nair', role: 'QA Lead', hours: 31.5 }], bestAttendance: [{ id: '2', name: 'Bala Kumar', role: 'Designer', days: 22 }, { id: '1', name: 'Asha Rao', role: 'Engineer', days: 21 }], newJoiners: [{ id: '9', name: 'Pooja Menon', role: 'Designer', joinedOn: '2026-10-05' }, { id: '10', name: 'Ravi Kumar', role: 'Engineer', joinedOn: '2026-10-06' }], newJoinerDays: 30 }) };
		case p === '/dashboard/freshness': return { body: ok({ asOf: '2026-10-13 10:00:00', timeEntries: { latestDate: '2026-10-12' }, attendance: { latestDate: '2026-10-12' }, imports: { lastCompletedAt: '2026-10-10 09:00:00' } }) };
		case p === '/dashboard/people-profiles': {
			const ids = (url.searchParams.get('employee_ids') || '').split(',').filter(Boolean);
			return { body: ok({ filters: {}, people: Object.fromEntries(ids.map((i) => [i, profile])), truncated: false }) };
		}
		case p === '/imports/templates': return { body: ok(templates) };
		case p === '/custom-fields': return list(customFields.filter((c) => !sp.get('module') || c.module === sp.get('module')));
		case p === '/employees': return list(query(people, ['full_name', 'employee_code', 'job_role']).map((e) => (sp.get('extra') === '1' ? { ...e, more_details: extraOf(e) } : e)));
		case /^\/employees\/\d+$/.test(p): return { body: ok(people.find((e) => `/employees/${e.ROWID}` === p) || people[0]) };
		case p === '/teams': return list(query(ROLE === 'admin' ? teams : teams.slice(0, 1), ['name', 'team_code', 'description']));
		case p === '/projects': return list(query(projects, ['project_name', 'project_code']));
		case p === '/project-assignments': return list(query(assignments, ['_emp', '_project', 'role_in_project']));
		case p === '/time-entries': return list(query(timeEntries, ['_emp', '_project', 'work_category', 'work_description']));
		case p === '/attendance': return list(query(attendanceRecords, ['_emp']));
		case p === '/leave': return list(query(leaveRecords, ['_emp', 'leave_type']));
		case p === '/performance': return list(query(performanceRecords, ['_emp', 'review_cycle']));
		case p === '/ai-usage': return list(query(aiUsageRecords, ['tool_name', 'tool_category', '_emp']));
		case p === '/product-items': return list(query(productItems, ['title', 'item_type']));
		case p === '/presentations': return list(decks.map(({ slides, config, ...row }) => { const first = slides.find((x) => x.type === 'custom'); return { ...row, slideCount: slides.length, studio: Boolean(first), cover: first ? { type: 'custom', bg: first.bg, objects: first.objects.slice(0, 10) } : null }; }));
		case /^\/presentations\/\d+$/.test(p): { const d = decks.find((x) => `/presentations/${x.ROWID}` === p); return d ? { body: ok(d) } : { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'This presentation does not exist.' } } }; }
		case p === '/reporting-structure': return { body: ok({ team: { id: '7', name: 'Delivery' }, employees: people.filter((e) => e.primary_team_id === '7').map((e) => ({ id: e.ROWID, name: e.full_name, jobRole: e.job_role, code: e.employee_code, sheetManagerId: e.reports_to_employee_id || null })), nodes: [{ employeeId: '2', parentId: null, roleLabel: 'Delivery Lead' }, { employeeId: '1', parentId: '2', roleLabel: null }] }) };
		case p === '/access/catalog': return { body: ok(perm.catalog()) };
		case p === '/access/roles': return { body: ok({ tablesReady: TABLES_READY, you: { roleKey: me.roleKey, canManageRoles: true, canManageUsers: true }, roles: roles() }) };
		case p === '/access/users': return list(query(accessUsers.map((u) => ({ ...u, ROWID: u.id, overrideCount: overridesOf(u.id).allow.length + overridesOf(u.id).deny.length })), ['displayName', 'email', 'roleName']));
		default: return list([]);
	}
}

http
	.createServer((req, res) => {
		const url = new URL(req.url, `http://localhost:${PORT}`);
		if (url.pathname === '/__catalyst/sdk/init.js') {
			// Replaces the real Catalyst Web SDK: "signed in" as the test user, nothing else.
			res.writeHead(200, { 'Content-Type': 'text/javascript' });
			return res.end('window.catalyst = { auth: { isUserAuthenticated: function () { return Promise.resolve(); }, signOut: function () { alert("Sign-out is disabled in local preview"); }, signIn: function () {} } };');
		}
		const bodyParts = [];
		req.on('data', (c) => bodyParts.push(c));
		req.on('end', () => {
			const p = url.pathname.replace(/^.*\/api\/v1/, '');
			let parsed = {};
			try {
				parsed = JSON.parse(Buffer.concat(bodyParts).toString() || '{}');
			} catch {
				parsed = {};
			}
			const out = route(req.method, p, url, parsed);
			// a little latency so loading states are visible while designing
			setTimeout(() => {
				res.writeHead(out.status || 200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ ...out.body, requestId: 'local-preview' }));
			}, 150);
		});
	})
	.listen(PORT, () => console.log(`[local preview] fake Catalyst + API on :${PORT}, signed in as ${me.displayName} (${me.roleName}). Nothing is sent to Catalyst.`));
