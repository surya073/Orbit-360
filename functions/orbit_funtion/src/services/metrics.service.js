'use strict';

/**
 * Central business rules for dashboard metrics. Pure functions over aggregate rows so every
 * consumer (overview, trends, snapshots, presentations) shares one definition.
 *
 * Every metric carries `completeness`:
 *   complete          inputs are all present
 *   partial           value computed, but some inputs are missing/unknown/pending (see `missing`)
 *   insufficient_data nothing eligible in scope; values are null (never 0)
 *   not_applicable    the metric cannot be computed for the chosen filters
 * Durations are integer minutes.
 */

const { COMPLETENESS: C } = require('../config/constants');
const { weekStart } = require('../utils/dateUtils');

const toNum = (v) => {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};
const isTrue = (v) => v === true || v === 'true';
const round1 = (n) => Math.round(n * 10) / 10;

const notApplicable = (reason) => ({ completeness: C.NOT_APPLICABLE, reason });

/**
 * approvedRows: grouped by is_billable over APPROVED entries [{ is_billable, minutes, entries }].
 * statusRows:   [{ approval_status, entries }] over all entries in scope.
 * Each entry is counted once; totals are never multiplied by team size or assignments.
 * Pending/rejected entries are excluded from every total.
 */
function timeMetrics(approvedRows, statusRows = []) {
	let billable = 0;
	let nonBillable = 0;
	let entries = 0;
	for (const r of approvedRows) {
		const minutes = toNum(r.minutes) ?? 0; // SUM over zero-minute entries is a real 0
		entries += toNum(r.entries) ?? 0;
		if (isTrue(r.is_billable)) billable += minutes;
		else nonBillable += minutes;
	}
	const excluded = { pending: 0, rejected: 0 };
	for (const r of statusRows) {
		if (r.approval_status === 'pending') excluded.pending += toNum(r.entries) ?? 0;
		if (r.approval_status === 'rejected') excluded.rejected += toNum(r.entries) ?? 0;
	}
	if (entries === 0) {
		return { completeness: C.INSUFFICIENT, billableMinutes: null, nonBillableMinutes: null, totalMinutes: null, billablePercent: null, approvedEntries: 0, excluded };
	}
	const total = billable + nonBillable;
	return {
		completeness: excluded.pending > 0 ? C.PARTIAL : C.COMPLETE,
		billableMinutes: billable,
		nonBillableMinutes: nonBillable,
		totalMinutes: total,
		billablePercent: total > 0 ? round1((billable / total) * 100) : null,
		approvedEntries: entries,
		excluded,
		...(excluded.pending > 0 ? { missing: 'pending_approval' } : {}),
	};
}

/** rows: [{ late_status, records }]. `unknown` is never counted as on-time. Uses only stored late_status. */
function attendanceMetrics(rows) {
	const c = { yes: 0, no: 0, unknown: 0 };
	for (const r of rows) c[r.late_status === 'yes' || r.late_status === 'no' ? r.late_status : 'unknown'] += toNum(r.records) ?? 0;
	const total = c.yes + c.no + c.unknown;
	const known = c.yes + c.no;
	if (total === 0) return { completeness: C.INSUFFICIENT, lateCount: null, onTimeCount: null, unknownCount: 0, lateRatePercent: null, records: 0 };
	return {
		completeness: c.unknown > 0 ? C.PARTIAL : C.COMPLETE,
		lateCount: c.yes,
		onTimeCount: c.no,
		unknownCount: c.unknown,
		lateRatePercent: known > 0 ? round1((c.yes / known) * 100) : null,
		records: total,
		...(c.unknown > 0 ? { missing: 'late_status_unknown' } : {}),
	};
}

/** rows: [{ status, unit_type, units, records }]. Days and hours are never added together. */
function leaveMetrics(rows, missingUnitsCount = 0) {
	const byStatus = {};
	let approvedDays = 0;
	let approvedHours = 0;
	let records = 0;
	for (const r of rows) {
		const n = toNum(r.records) ?? 0;
		records += n;
		byStatus[r.status] = (byStatus[r.status] || 0) + n;
		if (r.status === 'approved') {
			const units = toNum(r.units) ?? 0;
			if (r.unit_type === 'hours') approvedHours += units;
			else if (r.unit_type === 'days') approvedDays += units;
		}
	}
	if (records === 0) return { completeness: C.INSUFFICIENT, approvedDays: null, approvedHours: null, byStatus: {}, records: 0 };
	return {
		completeness: missingUnitsCount > 0 ? C.PARTIAL : C.COMPLETE,
		approvedDays,
		approvedHours,
		byStatus,
		records,
		...(missingUnitsCount > 0 ? { missing: 'units_not_recorded', missingUnitsCount } : {}),
	};
}

/** rows: [{ employment_status, employees }] */
function headcountMetrics(rows) {
	const byStatus = {};
	let total = 0;
	for (const r of rows) {
		const key = r.employment_status || 'unknown';
		const n = toNum(r.employees) ?? 0;
		byStatus[key] = (byStatus[key] || 0) + n;
		total += n;
	}
	if (total === 0) return { completeness: C.INSUFFICIENT, total: null, byStatus: {} };
	return { completeness: byStatus.unknown > 0 ? C.PARTIAL : C.COMPLETE, total, byStatus };
}

const bucketKey = (date, granularity) => (granularity === 'day' ? date : granularity === 'week' ? weekStart(date) : `${date.slice(0, 7)}-01`);

/**
 * Buckets daily aggregates into day/week/month points. Buckets with no data are omitted
 * rather than emitted as zero, so a gap on the chart means "no data".
 */
function timeTrend(dailyRows, pendingDaily, granularity) {
	const b = new Map();
	const at = (k) => {
		if (!b.has(k)) b.set(k, { start: k, billableMinutes: 0, nonBillableMinutes: 0, approvedEntries: 0, pendingEntries: 0 });
		return b.get(k);
	};
	for (const r of dailyRows) {
		const p = at(bucketKey(r.work_date, granularity));
		const m = toNum(r.minutes) ?? 0;
		if (isTrue(r.is_billable)) p.billableMinutes += m;
		else p.nonBillableMinutes += m;
		p.approvedEntries += toNum(r.entries) ?? 0;
	}
	for (const r of pendingDaily) at(bucketKey(r.work_date, granularity)).pendingEntries += toNum(r.entries) ?? 0;
	return [...b.values()]
		.sort((x, y) => (x.start < y.start ? -1 : 1))
		.map((p) => {
			const total = p.billableMinutes + p.nonBillableMinutes;
			const hasApproved = p.approvedEntries > 0;
			return {
				start: p.start,
				completeness: !hasApproved ? C.INSUFFICIENT : p.pendingEntries > 0 ? C.PARTIAL : C.COMPLETE,
				billableMinutes: hasApproved ? p.billableMinutes : null,
				nonBillableMinutes: hasApproved ? p.nonBillableMinutes : null,
				billablePercent: hasApproved && total > 0 ? round1((p.billableMinutes / total) * 100) : null,
				approvedEntries: p.approvedEntries,
				pendingEntries: p.pendingEntries,
			};
		});
}

function attendanceTrend(dailyRows, granularity) {
	const b = new Map();
	for (const r of dailyRows) {
		const k = bucketKey(r.attendance_date, granularity);
		if (!b.has(k)) b.set(k, { start: k, yes: 0, no: 0, unknown: 0 });
		b.get(k)[r.late_status === 'yes' || r.late_status === 'no' ? r.late_status : 'unknown'] += toNum(r.records) ?? 0;
	}
	return [...b.values()]
		.sort((x, y) => (x.start < y.start ? -1 : 1))
		.map((p) => {
			const known = p.yes + p.no;
			return {
				start: p.start,
				completeness: p.unknown > 0 ? C.PARTIAL : C.COMPLETE,
				lateCount: p.yes,
				onTimeCount: p.no,
				unknownCount: p.unknown,
				lateRatePercent: known > 0 ? round1((p.yes / known) * 100) : null,
			};
		});
}

/** rows: [{ current_status, projects }] */
function projectStatusMetrics(rows) {
	const byStatus = {};
	let total = 0;
	for (const r of rows) {
		const key = r.current_status || 'unknown';
		const n = toNum(r.projects) ?? 0;
		byStatus[key] = (byStatus[key] || 0) + n;
		total += n;
	}
	if (total === 0) return { completeness: C.INSUFFICIENT, total: null, byStatus: {} };
	return { completeness: byStatus.unknown > 0 ? C.PARTIAL : C.COMPLETE, total, byStatus, ...(byStatus.unknown > 0 ? { missing: 'status_not_recorded' } : {}) };
}

/**
 * Workload = approved minutes per project in the period; top N by minutes.
 * Burn = LIFETIME approved hours / estimated hours (like with like). It is null when no
 * estimate exists - never 0 - and no threshold is applied: over-estimate is a plain fact (>100).
 * workload: [{project_id, minutes, entries}], info: [{ROWID, project_name, current_status, estimated_hours}],
 * lifetime: [{project_id, minutes}]
 */
function workloadMetrics(workload, info, lifetime, { topN = 8, truncated = false } = {}) {
	const top = workload
		.map((w) => ({ projectId: String(w.project_id), minutes: toNum(w.minutes) ?? 0, entries: toNum(w.entries) ?? 0 }))
		.sort((a, b) => b.minutes - a.minutes)
		.slice(0, topN);
	const infoBy = new Map(info.map((p) => [String(p.ROWID), p]));
	const lifeBy = new Map(lifetime.map((l) => [String(l.project_id), toNum(l.minutes) ?? 0]));
	const projects = top.map((t) => {
		const p = infoBy.get(t.projectId);
		const est = p ? toNum(p.estimated_hours) : null;
		const life = lifeBy.get(t.projectId);
		return {
			projectId: t.projectId,
			name: p ? p.project_name : null,
			status: p ? p.current_status || null : null,
			periodMinutes: t.minutes,
			entries: t.entries,
			estimatedHours: est && est > 0 ? est : null,
			lifetimeMinutes: life === undefined ? null : life,
			burnPercent: est && est > 0 && life !== undefined ? round1((life / 60 / est) * 100) : null,
		};
	});
	if (projects.length === 0) return { completeness: C.INSUFFICIENT, projects: [], projectsWithTime: 0, truncated };
	const missing = projects.some((p) => p.estimatedHours === null);
	return {
		completeness: truncated || missing ? C.PARTIAL : C.COMPLETE,
		projects,
		projectsWithTime: workload.length,
		truncated,
		...(missing ? { missing: 'estimate_not_recorded' } : truncated ? { missing: 'result_truncated' } : {}),
	};
}

/** rows: [{ item_type, status, items }]; overdue = open items past their due date. */
function productMetrics(rows, overdue) {
	const byType = {};
	const byStatus = {};
	let total = 0;
	for (const r of rows) {
		const n = toNum(r.items) ?? 0;
		const type = r.item_type || 'unknown';
		const status = r.status || 'unknown';
		byType[type] = byType[type] || {};
		byType[type][status] = (byType[type][status] || 0) + n;
		byStatus[status] = (byStatus[status] || 0) + n;
		total += n;
	}
	if (total === 0) return { completeness: C.INSUFFICIENT, total: null, byType: {}, byStatus: {}, overdue: null };
	return { completeness: byStatus.unknown > 0 ? C.PARTIAL : C.COMPLETE, total, byType, byStatus, overdue, ...(byStatus.unknown > 0 ? { missing: 'status_not_recorded' } : {}) };
}

/** Reported (self-declared) usage; averages ignore records with no percentage. */
function aiUsageMetrics(rows, missingPeriod, { truncated = false } = {}) {
	const tools = rows
		.map((r) => ({ tool: r.tool_name, category: r.tool_category, records: toNum(r.records) ?? 0, avgReportedPercent: toNum(r.avg_percent) === null ? null : round1(toNum(r.avg_percent)) }))
		.sort((a, b) => b.records - a.records);
	const byCategory = {};
	for (const t of tools) byCategory[t.category] = (byCategory[t.category] || 0) + t.records;
	if (tools.length === 0) return { completeness: C.INSUFFICIENT, tools: [], byCategory: {}, totalRecords: null, missingPeriod, truncated };
	return {
		completeness: missingPeriod > 0 || truncated ? C.PARTIAL : C.COMPLETE,
		tools: tools.slice(0, 12),
		toolCount: tools.length,
		byCategory,
		totalRecords: tools.reduce((s, t) => s + t.records, 0),
		missingPeriod,
		truncated,
		...(missingPeriod > 0 ? { missing: 'reporting_period_not_recorded' } : {}),
	};
}

module.exports = { projectStatusMetrics, workloadMetrics, productMetrics, aiUsageMetrics, timeMetrics, attendanceMetrics, leaveMetrics, headcountMetrics, timeTrend, attendanceTrend, notApplicable, toNum, isTrue };
