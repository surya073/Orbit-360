'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');

const join = (parts) => parts.filter(Boolean).join(' AND ');

/**
 * Aggregate queries for the dashboard. Everything is a GROUP BY aggregate over a date range
 * (and team/project filters), so the number of rows returned is tiny and independent of table
 * size. No query here ever pages through a whole table.
 * Time entries are read from time_entries alone: never joined to assignments or headcount.
 */
function createDashboardRepository(db) {
	function conditions(scope, filters, { dateCol, teamCol, projectCol, employeeCol, rangeMode = 'point', extra = [] }) {
		assertScope(scope);
		const team = scope.resolveTeam(filters.teamId);
		const c = ['is_deleted = false'];
		if (rangeMode === 'overlap') {
			c.push(`start_date <= ${lit('date', filters.to)}`, `end_date >= ${lit('date', filters.from)}`);
		} else if (dateCol) {
			c.push(`${dateCol} >= ${lit('date', filters.from)}`, `${dateCol} <= ${lit('date', filters.to)}`);
		}
		if (team && teamCol) c.push(`${teamCol} = ${lit('id', team)}`);
		if (filters.projectId && projectCol) c.push(`${projectCol} = ${lit('id', filters.projectId)}`);
		if (filters.employeeId && employeeCol) c.push(`${employeeCol} = ${lit('id', filters.employeeId)}`);
		return join([...c, ...extra]);
	}
	const timeWhere = (scope, f, extra = []) => conditions(scope, f, { dateCol: 'work_date', teamCol: 'team_id', projectCol: 'project_id', employeeCol: 'employee_id', extra });

	return {
		/** Approved entries grouped by billable flag. */
		timeApproved: (scope, f) =>
			db.aggregate(`SELECT is_billable, SUM(duration_minutes) AS minutes, COUNT(ROWID) AS entries FROM time_entries WHERE ${timeWhere(scope, f, ["approval_status = 'approved'"])} GROUP BY is_billable`),
		/** Entry counts by approval status (to report what was excluded). */
		timeByStatus: (scope, f) => db.aggregate(`SELECT approval_status, COUNT(ROWID) AS entries FROM time_entries WHERE ${timeWhere(scope, f)} GROUP BY approval_status`),
		attendanceByLate: (scope, f) =>
			db.aggregate(`SELECT late_status, COUNT(ROWID) AS records FROM attendance_records WHERE ${conditions(scope, f, { dateCol: 'attendance_date', teamCol: 'team_id', employeeCol: 'employee_id' })} GROUP BY late_status`),
		leaveByStatus: (scope, f) =>
			db.aggregate(`SELECT status, unit_type, SUM(units) AS units, COUNT(ROWID) AS records FROM leave_records WHERE ${conditions(scope, f, { rangeMode: 'overlap', teamCol: 'team_id', employeeCol: 'employee_id' })} GROUP BY status, unit_type`),
		leaveMissingUnits: (scope, f) =>
			db.count(`SELECT COUNT(ROWID) AS total FROM leave_records WHERE ${conditions(scope, f, { rangeMode: 'overlap', teamCol: 'team_id', employeeCol: 'employee_id', extra: ['units IS NULL'] })}`),
		headcount: (scope, f) => {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `primary_team_id = ${lit('id', team)}` : null, f.employeeId ? `ROWID = ${lit('id', f.employeeId)}` : null]);
			return db.aggregate(`SELECT employment_status, COUNT(ROWID) AS employees FROM employees WHERE ${c} GROUP BY employment_status`);
		},

		// ---- breakdown widgets: all grouped aggregates, <= 300 rows by construction -------------
		projectsByStatus(scope, f) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `team_id = ${lit('id', team)}` : null, f.projectId ? `ROWID = ${lit('id', f.projectId)}` : null]);
			return db.aggregate(`SELECT current_status, COUNT(ROWID) AS projects FROM projects WHERE ${c} GROUP BY current_status LIMIT 0, 300`);
		},
		/** Approved minutes per project in the period. */
		workloadByProject: (scope, f) =>
			db.aggregate(`SELECT project_id, SUM(duration_minutes) AS minutes, COUNT(ROWID) AS entries FROM time_entries WHERE ${timeWhere(scope, f, ["approval_status = 'approved'"])} GROUP BY project_id LIMIT 0, 300`),
		/** Name/status/estimate for a handful of project ids (the top N), scoped. */
		projectInfo(scope, ids) {
			assertScope(scope);
			if (ids.length === 0) return Promise.resolve([]);
			const c = join(['is_deleted = false', `ROWID IN (${ids.map((i) => lit('id', i)).join(', ')})`, scope.condition('team_id')]);
			return db.select(`SELECT ROWID, project_name, current_status, estimated_hours FROM projects WHERE ${c} LIMIT 0, 50`, 'projects');
		},
		/** Lifetime approved minutes for specific projects (burn vs estimate compares like with like). */
		lifetimeMinutes(scope, ids) {
			assertScope(scope);
			if (ids.length === 0) return Promise.resolve([]);
			const c = join(['is_deleted = false', "approval_status = 'approved'", `project_id IN (${ids.map((i) => lit('id', i)).join(', ')})`, scope.condition('team_id')]);
			return db.aggregate(`SELECT project_id, SUM(duration_minutes) AS minutes FROM time_entries WHERE ${c} GROUP BY project_id LIMIT 0, 50`);
		},
		productByTypeStatus(scope, f) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `team_id = ${lit('id', team)}` : null, f.projectId ? `project_id = ${lit('id', f.projectId)}` : null]);
			return db.aggregate(`SELECT item_type, status, COUNT(ROWID) AS items FROM product_items WHERE ${c} GROUP BY item_type, status LIMIT 0, 300`);
		},
		productOverdue(scope, f, yesterday) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `team_id = ${lit('id', team)}` : null, f.projectId ? `project_id = ${lit('id', f.projectId)}` : null, `due_date <= ${lit('date', yesterday)}`, 'completed_date IS NULL']);
			return db.count(`SELECT COUNT(ROWID) AS total FROM product_items WHERE ${c}`);
		},
		/** Reporting periods are YYYY-MM strings; the dashboard range maps to its first and last month. */
		aiUsageByTool(scope, f) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `team_id = ${lit('id', team)}` : null, f.projectId ? `project_id = ${lit('id', f.projectId)}` : null, `reporting_period >= ${lit('str', f.from.slice(0, 7))}`, `reporting_period <= ${lit('str', f.to.slice(0, 7))}`]);
			return db.aggregate(`SELECT tool_name, tool_category, COUNT(ROWID) AS records, AVG(usage_percent_reported) AS avg_percent FROM ai_usage_records WHERE ${c} GROUP BY tool_name, tool_category LIMIT 0, 300`);
		},
		aiUsageMissingPeriod(scope, f) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const c = join(['is_deleted = false', team ? `team_id = ${lit('id', team)}` : null, f.projectId ? `project_id = ${lit('id', f.projectId)}` : null, 'reporting_period IS NULL']);
			return db.count(`SELECT COUNT(ROWID) AS total FROM ai_usage_records WHERE ${c}`);
		},

		// ---- data freshness: the newest business date/time seen per source ----------------------
		async freshness(scope, f) {
			assertScope(scope);
			const team = scope.resolveTeam(f.teamId);
			const t = (col) => (team ? ` AND ${col} = ${lit('id', team)}` : '');
			const one = async (sql) => {
				const rows = await db.aggregate(sql);
				return (rows[0] && rows[0].latest) || null;
			};
			return Promise.all([
				one(`SELECT MAX(work_date) AS latest FROM time_entries WHERE is_deleted = false${t('team_id')}`),
				one(`SELECT MAX(attendance_date) AS latest FROM attendance_records WHERE is_deleted = false${t('team_id')}`),
				one(`SELECT MAX(finished_at) AS latest FROM import_jobs WHERE status IN ('completed', 'completed_with_errors')${t('team_id')}`),
			]);
		},

		// ---- trends: one grouped query per series, bounded by the 90-day cap -----------------
		timeDaily: (scope, f) =>
			db.aggregate(`SELECT work_date, is_billable, SUM(duration_minutes) AS minutes, COUNT(ROWID) AS entries FROM time_entries WHERE ${timeWhere(scope, f, ["approval_status = 'approved'"])} GROUP BY work_date, is_billable LIMIT 0, 300`),
		timePendingDaily: (scope, f) =>
			db.aggregate(`SELECT work_date, COUNT(ROWID) AS entries FROM time_entries WHERE ${timeWhere(scope, f, ["approval_status = 'pending'"])} GROUP BY work_date LIMIT 0, 300`),
		attendanceDaily: (scope, f) =>
			db.aggregate(`SELECT attendance_date, late_status, COUNT(ROWID) AS records FROM attendance_records WHERE ${conditions(scope, f, { dateCol: 'attendance_date', teamCol: 'team_id', employeeCol: 'employee_id' })} GROUP BY attendance_date, late_status LIMIT 0, 300`),
	};
}

module.exports = { createDashboardRepository };
