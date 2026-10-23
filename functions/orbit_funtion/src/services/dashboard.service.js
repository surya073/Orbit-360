'use strict';

const { errors } = require('../utils/errors');
const { businessNow, businessToday, addDays } = require('../utils/dateUtils');
const { LIMITS } = require('../config/constants');
const { environment } = require('../config/environment');
const m = require('./metrics.service');
const { audit } = require('./audit.service');

const PROFILE_PROJECTS = 5; // projects listed per person
const PROJECT_FILTER_REASON = 'Not available when filtering by project';

/**
 * Overview KPIs. Six grouped queries at most (2 time, 1 attendance, 2 leave, 1 headcount),
 * regardless of table size. Attendance, leave and headcount are not attributable to a single
 * project, so with a project filter they return not_applicable and cost no queries.
 */
async function overview(ctx, filters) {
	const { scope, repos } = ctx;
	const team = scope.resolveTeam(filters.teamId); // throws 403 for managers asking for another team
	const byProject = Boolean(filters.projectId);
	const d = repos.dashboard;

	const [approved, byStatus, att, leave, leaveMissing, headcount] = await Promise.all([
		d.timeApproved(scope, filters),
		d.timeByStatus(scope, filters),
		byProject ? null : d.attendanceByLate(scope, filters),
		byProject ? null : d.leaveByStatus(scope, filters),
		byProject ? null : d.leaveMissingUnits(scope, filters),
		byProject ? null : d.headcount(scope, filters),
	]);

	return {
		filters: { from: filters.from, to: filters.to, teamId: team, projectId: filters.projectId || null, employeeId: filters.employeeId || null, timezone: 'Asia/Kolkata' },
		time: m.timeMetrics(approved, byStatus),
		attendance: byProject ? m.notApplicable(PROJECT_FILTER_REASON) : m.attendanceMetrics(att),
		leave: byProject ? m.notApplicable(PROJECT_FILTER_REASON) : m.leaveMetrics(leave, leaveMissing),
		headcount: byProject ? m.notApplicable(PROJECT_FILTER_REASON) : m.headcountMetrics(headcount),
	};
}

/** Trends: three grouped-by-day queries over <= 90 days, bucketed in memory. */
async function trends(ctx, filters) {
	const { scope, repos } = ctx;
	const team = scope.resolveTeam(filters.teamId);
	const byProject = Boolean(filters.projectId);
	const d = repos.dashboard;
	const [daily, pending, att] = await Promise.all([
		d.timeDaily(scope, filters),
		d.timePendingDaily(scope, filters),
		byProject ? null : d.attendanceDaily(scope, filters),
	]);
	// A result at the row cap may have been truncated; say so rather than present it as complete.
	const truncated = daily.length >= 300 || pending.length >= 300 || (att && att.length >= 300);
	return {
		filters: { from: filters.from, to: filters.to, teamId: team, projectId: filters.projectId || null, employeeId: filters.employeeId || null, granularity: filters.granularity, timezone: 'Asia/Kolkata' },
		truncated,
		time: m.timeTrend(daily, pending, filters.granularity),
		attendance: byProject ? m.notApplicable(PROJECT_FILTER_REASON) : m.attendanceTrend(att, filters.granularity),
	};
}

/** Freezes one overview result (computed once) into report_snapshots. */
async function createSnapshot(ctx, filters) {
	const { scope, repos } = ctx;
	const data = await overview(ctx, filters);
	const summary = JSON.stringify(data);
	if (summary.length > LIMITS.maxTextConfig) throw errors.badRequest('Snapshot is too large to store');
	const now = new Date();
	const teamId = data.filters.teamId;
	const row = await repos.snapshots.insert(scope, {
		report_type: 'dashboard',
		...(teamId ? { team_id: teamId } : {}),
		period_start: filters.from,
		period_end: filters.to,
		parameters: JSON.stringify(data.filters),
		summary_json: summary,
		data_version: '1',
		status: 'complete',
		generated_by_user_id: ctx.actor.userId,
		generated_at: businessNow(now),
		expires_at: businessNow(new Date(now.getTime() + environment.snapshotRetentionDays * 86400000)),
	});
	await audit(ctx, { action: 'create', table: 'report_snapshots', rowId: row.ROWID, teamId });
	return { ROWID: String(row.ROWID), ...data };
}

async function getSnapshot(ctx, id) {
	const row = await ctx.repos.snapshots.findById(ctx.scope, id);
	if (!row) throw errors.notFound();
	let summary = null;
	try {
		summary = JSON.parse(row.summary_json);
	} catch {
		/* reported below as unavailable */
	}
	const { summary_json, ...rest } = row;
	return { ...rest, summary, summaryAvailable: summary !== null };
}

const listSnapshots = (ctx, paging) => ctx.repos.snapshots.list(ctx.scope, paging);

const echoFilters = (ctx, f) => ({ from: f.from, to: f.to, teamId: ctx.scope.resolveTeam(f.teamId), projectId: f.projectId || null, timezone: 'Asia/Kolkata' });

/**
 * Project status mix + workload (approved time per project, top 8) with burn vs estimate.
 * Queries: status groups (1), workload groups (1), then ONE lookup each for names and lifetime
 * hours of only the top projects - independent of how many projects exist.
 */
async function projects(ctx, f) {
	const { scope, repos } = ctx;
	const d = repos.dashboard;
	const [statusRows, workload] = await Promise.all([d.projectsByStatus(scope, f), d.workloadByProject(scope, f)]);
	const topIds = workload
		.map((w) => ({ id: String(w.project_id), minutes: m.toNum(w.minutes) ?? 0 }))
		.sort((a, b) => b.minutes - a.minutes)
		.slice(0, 8)
		.map((w) => w.id);
	const [info, lifetime] = await Promise.all([d.projectInfo(scope, topIds), d.lifetimeMinutes(scope, topIds)]);
	return {
		filters: echoFilters(ctx, f),
		status: m.projectStatusMetrics(statusRows),
		workload: m.workloadMetrics(workload, info, lifetime, { truncated: workload.length >= 300 }),
	};
}

/** Product development status: current state (not date-filtered) by type and status, plus overdue open items. */
async function product(ctx, f) {
	const { scope, repos } = ctx;
	const yesterday = addDays(businessToday(), -1);
	const [rows, overdue] = await Promise.all([repos.dashboard.productByTypeStatus(scope, f), repos.dashboard.productOverdue(scope, f, yesterday)]);
	return { filters: echoFilters(ctx, f), asOf: businessToday(), product: m.productMetrics(rows, overdue) };
}

const HIGHLIGHT_TOP = 10; // the dashboard card shows three; presentation leaderboards up to ten
const NEW_JOINER_DAYS = 30;
const NEW_JOINER_MAX = 5;

/**
 * People worth a mention for the selected period: who logged the most approved hours, who checked in on time most
 * often, and who joined in the last 30 days. Two grouped queries and one new-joiner query, then ONE lookup of the
 * few names shown, so the cost does not grow with the number of people. A list is simply empty when there is no data
 * (never padded with zeros).
 */
async function highlights(ctx, f) {
	const { scope, repos } = ctx;
	const d = repos.dashboard;
	const since = addDays(f.to, -NEW_JOINER_DAYS);
	const [minutes, onTime, joiners] = await Promise.all([d.minutesByEmployee(scope, f), d.onTimeByEmployee(scope, f), d.newJoiners(scope, f, since, NEW_JOINER_MAX)]);
	const top = (rows, key) =>
		rows
			.map((r) => ({ id: String(r.employee_id), value: m.toNum(r[key]) ?? 0 }))
			.filter((r) => r.value > 0)
			.sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1))
			.slice(0, HIGHLIGHT_TOP);
	const hours = top(minutes, 'minutes');
	const days = top(onTime, 'days');
	const names = new Map((await d.employeeNames(scope, [...new Set([...hours, ...days].map((r) => r.id))])).map((r) => [String(r.ROWID), r]));
	const person = (r, extra) => {
		const e = names.get(r.id);
		return e ? { id: r.id, name: e.full_name, role: e.job_role || null, ...extra(r) } : null; // out of scope or removed: not shown
	};
	return {
		filters: echoFilters(ctx, f),
		topPerformers: hours.map((r) => person(r, (x) => ({ hours: Math.round((x.value / 60) * 10) / 10 }))).filter(Boolean),
		bestAttendance: days.map((r) => person(r, (x) => ({ days: x.value }))).filter(Boolean),
		newJoiners: [...joiners].sort((a, b) => String(b.joining_date).localeCompare(String(a.joining_date))).map((e) => ({ id: String(e.ROWID), name: e.full_name, role: e.job_role || null, joinedOn: e.joining_date })),
		newJoinerDays: NEW_JOINER_DAYS,
	};
}

/** Reported AI/tool usage for the reporting months covered by the range. */
async function aiUsage(ctx, f) {
	const { scope, repos } = ctx;
	const [rows, missingPeriod] = await Promise.all([repos.dashboard.aiUsageByTool(scope, f), repos.dashboard.aiUsageMissingPeriod(scope, f)]);
	return { filters: echoFilters(ctx, f), usage: m.aiUsageMetrics(rows, missingPeriod, { truncated: rows.length >= 300 }) };
}

const byEmployee = (rows, key = 'employee_id') => {
	const map = new Map();
	for (const r of rows) {
		const id = String(r[key]);
		if (!map.has(id)) map.set(id, []);
		map.get(id).push(r);
	}
	return map;
};

/**
 * Everything the presentation's individual profile slides show, for up to PROFILE_MAX people in
 * one call: approved billable/non-billable time, attendance (late check-ins), leave, reported AI
 * usage, assigned product items and the projects they logged time on. Eight grouped queries plus
 * one project-name lookup regardless of how many people; every figure reuses the shared metric
 * rules, so a person with no records reads insufficient_data (never 0).
 */
async function peopleProfiles(ctx, f, ids) {
	const { scope, repos } = ctx;
	const d = repos.dashboard;
	scope.resolveTeam(f.teamId); // 403 for a manager asking for another team
	const [time, pending, projectRows, att, leave, leaveMissing, ai, product] = await Promise.all([
		d.peopleTime(scope, f, ids),
		d.peopleTimePending(scope, f, ids),
		d.peopleProjects(scope, f, ids),
		d.peopleAttendance(scope, f, ids),
		d.peopleLeave(scope, f, ids),
		d.peopleLeaveMissing(scope, f, ids),
		d.peopleAi(scope, f, ids),
		d.peopleProduct(scope, f, ids),
	]);
	const g = { time: byEmployee(time), pending: byEmployee(pending), projects: byEmployee(projectRows), att: byEmployee(att), leave: byEmployee(leave), missing: byEmployee(leaveMissing), ai: byEmployee(ai), product: byEmployee(product, 'assignee_employee_id') };

	const topProjects = new Map();
	for (const id of ids) {
		const list = (g.projects.get(id) || [])
			.map((r) => ({ projectId: String(r.project_id), minutes: m.toNum(r.minutes) ?? 0, entries: m.toNum(r.entries) ?? 0 }))
			.sort((a, b) => b.minutes - a.minutes);
		topProjects.set(id, { all: list.length, top: list.slice(0, PROFILE_PROJECTS) });
	}
	const projectIds = [...new Set([...topProjects.values()].flatMap((p) => p.top.map((t) => t.projectId)))].slice(0, 50);
	const info = new Map((await d.projectInfo(scope, projectIds)).map((p) => [String(p.ROWID), p]));

	const people = {};
	for (const id of ids) {
		const pendingRows = g.pending.get(id) || [];
		const missing = (g.missing.get(id) || [])[0];
		const tp = topProjects.get(id);
		people[id] = {
			time: m.timeMetrics(g.time.get(id) || [], pendingRows.length ? [{ approval_status: 'pending', entries: pendingRows[0].entries }] : []),
			attendance: m.attendanceMetrics(g.att.get(id) || []),
			leave: m.leaveMetrics(g.leave.get(id) || [], missing ? m.toNum(missing.total) ?? 0 : 0),
			ai: m.aiUsageMetrics(g.ai.get(id) || [], 0),
			product: m.productMetrics(g.product.get(id) || [], null),
			projects: {
				total: tp.all,
				items: tp.top.map((t) => {
					const p = info.get(t.projectId);
					return { projectId: t.projectId, name: p ? p.project_name : null, status: p ? p.current_status || null : null, periodMinutes: t.minutes, entries: t.entries };
				}),
			},
		};
	}
	return { filters: echoFilters(ctx, f), people, truncated: [time, projectRows, att, leave, ai, product].some((r) => r.length >= 300) };
}

/** Newest business date per source so users can judge how current the numbers are. */
async function freshness(ctx, f) {
	const [time, attendance, imported] = await ctx.repos.dashboard.freshness(ctx.scope, f);
	return {
		asOf: businessNow(),
		timeEntries: { latestDate: time },
		attendance: { latestDate: attendance },
		imports: { lastCompletedAt: imported },
	};
}

module.exports = { highlights, overview, trends, createSnapshot, getSnapshot, listSnapshots, projects, product, aiUsage, freshness, peopleProfiles };
