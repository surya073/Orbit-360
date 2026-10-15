'use strict';

const { errors } = require('../utils/errors');
const { isValidDate, businessToday, monthRange, daysBetween } = require('../utils/dateUtils');
const { parseFilterValue } = require('./query.validators');
const { LIMITS } = require('../config/constants');

const present = (v) => v !== undefined && v !== '' && v !== null;

/**
 * Dashboard filter contract:
 *   from, to      YYYY-MM-DD business dates (Asia/Kolkata); default = current month
 *   team_id       admin only (managers are pinned server-side)
 *   project_id, employee_id   optional narrowing filters
 */
function parseDashboardFilters(raw, { maxDays = LIMITS.maxDashboardDays, now } = {}) {
	const def = monthRange(businessToday(now));
	const from = present(raw.from) ? raw.from : def.from;
	const to = present(raw.to) ? raw.to : def.to;
	if (!isValidDate(from) || !isValidDate(to)) throw errors.badRequest('from/to must be YYYY-MM-DD');
	if (to < from) throw errors.badRequest('to must not be before from');
	if (daysBetween(from, to) + 1 > maxDays) throw errors.badRequest(`Range cannot exceed ${maxDays} days`);
	return {
		from,
		to,
		teamId: present(raw.team_id) ? parseFilterValue('id', raw.team_id, 'team_id') : undefined,
		projectId: present(raw.project_id) ? parseFilterValue('id', raw.project_id, 'project_id') : undefined,
		employeeId: present(raw.employee_id) ? parseFilterValue('id', raw.employee_id, 'employee_id') : undefined,
	};
}

const overviewQuery = (raw) => parseDashboardFilters(raw);

function trendsQuery(raw) {
	const granularity = present(raw.granularity) ? raw.granularity : 'week';
	if (!['day', 'week', 'month'].includes(granularity)) throw errors.badRequest('granularity must be day, week or month');
	// Default window: the last 12 weeks ending today; always bounded by maxTrendDays.
	const today = businessToday();
	const f = parseDashboardFilters(
		{ ...raw, from: present(raw.from) ? raw.from : new Date(Date.parse(`${today}T00:00:00Z`) - 83 * 86400000).toISOString().slice(0, 10), to: present(raw.to) ? raw.to : today },
		{ maxDays: LIMITS.maxTrendDays }
	);
	return { ...f, granularity };
}

const PROFILE_MAX = 12;
/** GET /dashboard/people-profiles?employee_ids=1,2,3 plus the usual period/team filters. */
function peopleProfilesQuery(raw) {
	const f = parseDashboardFilters(raw);
	const ids = String(raw.employee_ids || '')
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
	if (ids.length === 0) throw errors.badRequest('employee_ids is required');
	if (ids.length > PROFILE_MAX) throw errors.badRequest(`At most ${PROFILE_MAX} employees per request`);
	return { ...f, employeeIds: [...new Set(ids.map((v) => parseFilterValue('id', v, 'employee_ids')))] };
}

/** POST /dashboard/snapshots takes the same filters in the body. */
const snapshotBody = (raw) => parseDashboardFilters(raw || {});

module.exports = { parseDashboardFilters, overviewQuery, trendsQuery, snapshotBody, peopleProfilesQuery };
