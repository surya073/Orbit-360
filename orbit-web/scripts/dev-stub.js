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
];
const people = [
	{ ROWID: '1', full_name: 'Asha Rao', employee_code: 'E-100', job_role: 'Senior Engineer', employment_status: 'active', primary_team_id: '7', joining_date: '2022-03-14', reports_to_employee_id: '2' },
	{ ROWID: '2', full_name: 'Bala Iyer', employee_code: 'E-101', job_role: 'Delivery Lead', employment_status: 'active', primary_team_id: '7', joining_date: '2020-01-06' },
	{ ROWID: '3', full_name: 'Chitra Nair', employee_code: 'E-102', job_role: 'Business Analyst', employment_status: 'on_leave', primary_team_id: '7', joining_date: '2023-07-01', reports_to_employee_id: '2' },
	{ ROWID: '4', full_name: 'Dev Patel', employee_code: 'E-103', job_role: 'QA Engineer', employment_status: 'active', primary_team_id: '8', joining_date: '2021-11-22' },
];
const projects = [
	{ ROWID: '1', project_name: 'Atlas Platform Migration', project_code: 'PRJ-ATLAS', team_id: '7', current_status: 'active', estimated_hours: 400 },
	{ ROWID: '2', project_name: 'Orion', project_code: 'PRJ-ORION', team_id: '7', current_status: 'on_hold', estimated_hours: 120 },
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
	headcount: { completeness: 'complete', total: 4, byStatus: { active: 3, on_leave: 1 } },
};
const field = (f, type, extra = {}) => ({ field: f, type, required: false, ...extra });
const templateOf = (module, columns, write = ROLE === 'admin' || module !== 'teams') => ({
	module,
	importable: module !== 'teams',
	adminOnly: !write,
	permissions: { view: true, create: write, edit: write, delete: write && module !== 'teams' },
	immutable: [],
	importColumns: ['source_record_id'],
	columns,
});
const templates = [
	templateOf('employees', [field('full_name', 'str', { required: true, maxLength: 200 }), field('job_role', 'str', { maxLength: 120 }), field('joining_date', 'date'), field('employment_status', 'enum', { values: ['active', 'inactive', 'on_leave'] }), field('primary_team_id', 'id'), field('more_details', 'json')]),
	templateOf('teams', [field('team_code', 'str', { required: true }), field('name', 'str', { required: true })]),
	templateOf('projects', [field('project_name', 'str', { required: true }), field('current_status', 'str')]),
];

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
const deck = { ROWID: '5', title: 'Board review', team_id: '7', status: 'ready', slidesAvailable: true, last_presented_at: null, MODIFIEDTIME: '2026-10-10 09:00:00', slides: deckSlides, config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: null, projectId: null }, slides: deckSlides } };
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

function route(method, p, url) {
	if (method !== 'GET') return { status: method === 'POST' ? 201 : 200, body: ok({ ROWID: '999', id: '999', key: 'new_role', granted: 0, revoked: 0 }) };
	const list = (rows) => ({ body: ok(rows, meta(rows.length)) });
	switch (true) {
		case p === '/me': return { body: ok(me) };
		case p === '/dashboard/overview': return { body: ok(overview) };
		case p === '/dashboard/trends': return { body: ok({ filters: { granularity: 'week' }, truncated: false, time: trendTime, attendance: trendAttendance }) };
		case p === '/dashboard/projects': return { body: ok({ filters: {}, status: { completeness: 'complete', total: 7, byStatus: { active: 5, on_hold: 1, completed: 1 } }, workload: { completeness: 'complete', projectsWithTime: workload.length, truncated: false, projects: workload } }) };
		case p === '/dashboard/product': return { body: ok({ asOf: '2026-10-13', product: { completeness: 'complete', total: 9, byStatus: { open: 4, done: 5 }, byType: { bug: { open: 2, done: 1 }, feature: { open: 2, done: 4 } }, overdue: 2 } }) };
		case p === '/dashboard/ai-usage': return { body: ok({ usage: { completeness: 'complete', totalRecords: 20, toolCount: 5, byCategory: { ai: 12, other: 4, github: 4 }, missingPeriod: 0, tools } }) };
		case p === '/dashboard/freshness': return { body: ok({ asOf: '2026-10-13 10:00:00', timeEntries: { latestDate: '2026-10-12' }, attendance: { latestDate: '2026-10-12' }, imports: { lastCompletedAt: '2026-10-10 09:00:00' } }) };
		case p === '/dashboard/people-profiles': {
			const ids = (url.searchParams.get('employee_ids') || '').split(',').filter(Boolean);
			return { body: ok({ filters: {}, people: Object.fromEntries(ids.map((i) => [i, profile])), truncated: false }) };
		}
		case p === '/imports/templates': return { body: ok(templates) };
		case p === '/employees': return list(people);
		case /^\/employees\/\d+$/.test(p): return { body: ok(people[0]) };
		case p === '/teams': return list(ROLE === 'admin' ? teams : teams.slice(0, 1));
		case p === '/projects': return list(projects);
		case p === '/presentations': return list([deck]);
		case p === '/presentations/5': return { body: ok(deck) };
		case p === '/reporting-structure': return { body: ok({ team: { id: '7', name: 'Delivery' }, employees: people.filter((e) => e.primary_team_id === '7').map((e) => ({ id: e.ROWID, name: e.full_name, jobRole: e.job_role, code: e.employee_code, sheetManagerId: e.reports_to_employee_id || null })), nodes: [{ employeeId: '2', parentId: null, roleLabel: 'Delivery Lead' }, { employeeId: '1', parentId: '2', roleLabel: null }] }) };
		case p === '/access/catalog': return { body: ok(perm.catalog()) };
		case p === '/access/roles': return { body: ok({ tablesReady: TABLES_READY, you: { roleKey: me.roleKey, canManageRoles: true, canManageUsers: true }, roles: roles() }) };
		case p === '/access/users': return { body: ok(accessUsers, meta(accessUsers.length, 20)) };
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
		let chunks = 0;
		req.on('data', (c) => (chunks += c.length));
		req.on('end', () => {
			const p = url.pathname.replace(/^.*\/api\/v1/, '');
			const out = route(req.method, p, url);
			// a little latency so loading states are visible while designing
			setTimeout(() => {
				res.writeHead(out.status || 200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ ...out.body, requestId: 'local-preview' }));
			}, 150);
		});
	})
	.listen(PORT, () => console.log(`[local preview] fake Catalyst + API on :${PORT}, signed in as ${me.displayName} (${me.roleName}). Nothing is sent to Catalyst.`));
