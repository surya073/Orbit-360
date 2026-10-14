'use strict';

const { errors } = require('../utils/errors');
const { businessNow, businessToday, addDays } = require('../utils/dateUtils');
const { LIMITS } = require('../config/constants');
const { environment } = require('../config/environment');
const m = require('./metrics.service');
const { audit } = require('./audit.service');

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

/** Reported AI/tool usage for the reporting months covered by the range. */
async function aiUsage(ctx, f) {
	const { scope, repos } = ctx;
	const [rows, missingPeriod] = await Promise.all([repos.dashboard.aiUsageByTool(scope, f), repos.dashboard.aiUsageMissingPeriod(scope, f)]);
	return { filters: echoFilters(ctx, f), usage: m.aiUsageMetrics(rows, missingPeriod, { truncated: rows.length >= 300 }) };
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

module.exports = { overview, trends, createSnapshot, getSnapshot, listSnapshots, projects, product, aiUsage, freshness };
