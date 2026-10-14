'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const m = require('../services/metrics.service');
const { validateRecord, f } = require('../validators/schema');
const { listQuery, crudBody } = require('../validators/query.validators');
const { parseDashboardFilters, trendsQuery } = require('../validators/dashboard.validators');
const { validateSlides } = require('../validators/presentations.validators');
const { buildListQueries } = require('../repositories/queryBuilder');
const { resources } = require('../config/resources');
const { loadEnvironment } = require('../config/environment');
const { match } = require('../routes');
const { businessToday, businessNow, monthRange, isValidDate, weekStart } = require('../utils/dateUtils');
const { Scope, requireScope } = require('../services/scope.service');
const { createLogger } = require('../utils/logger');
const { classifyDbError } = require('../utils/errors');
const { matchKeyFor, safeKey } = require('../services/recordRules');

const admin = new Scope({ role: 'admin', teamId: null });
const manager = new Scope({ role: 'manager', teamId: '7' });

// ---- metrics: billable hours -------------------------------------------------------------
test('approved billable and non-billable minutes are separate and each entry counts once', () => {
	const r = m.timeMetrics([{ is_billable: 'true', minutes: '300', entries: '3' }, { is_billable: 'false', minutes: '100', entries: '2' }]);
	assert.equal(r.billableMinutes, 300);
	assert.equal(r.nonBillableMinutes, 100);
	assert.equal(r.totalMinutes, 400);
	assert.equal(r.billablePercent, 75);
	assert.equal(r.approvedEntries, 5);
	assert.equal(r.completeness, 'complete');
});

test('no approved entries is insufficient_data with null values, not zero', () => {
	const r = m.timeMetrics([], [{ approval_status: 'pending', entries: '4' }]);
	assert.equal(r.completeness, 'insufficient_data');
	assert.equal(r.billableMinutes, null);
	assert.equal(r.excluded.pending, 4);
});

test('pending entries are excluded and mark the metric partial', () => {
	const r = m.timeMetrics([{ is_billable: 'true', minutes: '60', entries: '1' }], [{ approval_status: 'pending', entries: '2' }, { approval_status: 'rejected', entries: '1' }]);
	assert.equal(r.completeness, 'partial');
	assert.equal(r.missing, 'pending_approval');
	assert.equal(r.totalMinutes, 60);
	assert.equal(r.excluded.rejected, 1);
});

test('approved zero-minute entries give a real zero total and a null percentage', () => {
	const r = m.timeMetrics([{ is_billable: 'true', minutes: '0', entries: '2' }]);
	assert.equal(r.totalMinutes, 0);
	assert.equal(r.billablePercent, null);
	assert.equal(r.completeness, 'complete');
});

test('attendance: unknown is never on-time; empty is insufficient_data, not zero attendance', () => {
	const r = m.attendanceMetrics([{ late_status: 'yes', records: '1' }, { late_status: 'no', records: '3' }, { late_status: 'unknown', records: '2' }]);
	assert.equal(r.lateRatePercent, 25);
	assert.equal(r.unknownCount, 2);
	assert.equal(r.completeness, 'partial');
	const none = m.attendanceMetrics([]);
	assert.equal(none.completeness, 'insufficient_data');
	assert.equal(none.lateRatePercent, null);
});

test('leave: days and hours stay separate; missing units flagged partial', () => {
	const r = m.leaveMetrics([{ status: 'approved', unit_type: 'days', units: '3', records: '2' }, { status: 'approved', unit_type: 'hours', units: '4', records: '1' }, { status: 'requested', unit_type: 'days', units: '9', records: '1' }], 1);
	assert.equal(r.approvedDays, 3);
	assert.equal(r.approvedHours, 4);
	assert.equal(r.completeness, 'partial');
});

test('trend buckets omit empty periods and flag pending-only buckets', () => {
	const daily = [{ work_date: '2026-10-05', is_billable: 'true', minutes: '60', entries: '1' }, { work_date: '2026-10-06', is_billable: 'false', minutes: '30', entries: '1' }];
	const pending = [{ work_date: '2026-10-06', entries: '1' }, { work_date: '2026-10-20', entries: '2' }];
	const t = m.timeTrend(daily, pending, 'week');
	assert.deepEqual(t.map((p) => p.start), ['2026-10-05', '2026-10-19']);
	assert.equal(t[0].completeness, 'partial');
	assert.equal(t[0].billableMinutes, 60);
	assert.equal(t[1].completeness, 'insufficient_data');
	assert.equal(t[1].billableMinutes, null);
	assert.equal(weekStart('2026-10-11'), '2026-10-05'); // Sunday belongs to the Monday-start week
});

// ---- validation ---------------------------------------------------------------------------
test('validation rejects unknown fields and bad values and never defaults missing values to 0', () => {
	const fields = { n: f.int({ min: 0 }), d: f.date(), s: f.str(5, { req: true }) };
	const { value, errors } = validateRecord(fields, { n: '-1', d: '2026-02-30', x: 1 });
	assert.deepEqual(errors.map((e) => e.code).sort(), ['INVALID_DATE', 'OUT_OF_RANGE', 'REQUIRED', 'UNKNOWN_FIELD']);
	assert.equal('n' in value, false);
	const good = validateRecord(fields, { s: 'ab' });
	assert.equal('n' in good.value, false);
	assert.deepEqual(good.errors, []);
});

test('booleans normalise to Data Store strings and emoji is stripped', () => {
	const { value } = validateRecord({ b: f.bool(), s: f.str(20) }, { b: false, s: 'hi \u{1F600}' });
	assert.equal(value.b, 'false');
	assert.equal(value.s, 'hi');
});

test('more_details must be a bounded JSON object', () => {
	const fields = resources.employees.fields;
	assert.deepEqual(validateRecord(fields, { full_name: 'A', more_details: { team: 'x' } }).errors, []);
	assert.equal(validateRecord(fields, { full_name: 'A', more_details: '[1]' }).errors[0].code, 'INVALID_JSON');
	assert.equal(validateRecord(fields, { full_name: 'A', more_details: 'nope' }).errors[0].code, 'INVALID_JSON');
	assert.equal(validateRecord(fields, { full_name: 'A', more_details: { a: 'x'.repeat(9500) } }).errors[0].code, 'TOO_LONG');
	assert.throws(() => crudBody(resources.employees, { partial: true })({}), { code: 'BAD_REQUEST' });
});

// ---- query bounds -------------------------------------------------------------------------
test('list queries are scoped, soft-delete aware, column-limited and bounded', () => {
	const input = listQuery(resources.time_entries)({ from: '2026-10-01' });
	const q = buildListQueries(resources.time_entries, input, manager);
	assert.match(q.listSql, /is_deleted = false AND team_id = 7 AND work_date >= '2026-10-01'/);
	assert.match(q.listSql, /LIMIT 0, 25$/);
	assert.doesNotMatch(q.listSql, /SELECT \*/);
});

test('every list selects at most 20 columns (ZCQL limit)', () => {
	for (const [name, r] of Object.entries(resources)) assert.ok(r.list.length <= 20, name);
});

test('page size, ids and ranges are capped; injection-shaped input is rejected', () => {
	const lq = (res, raw) => listQuery(resources[res])(raw);
	assert.throws(() => lq('employees', { pageSize: '101' }), { code: 'BAD_REQUEST' });
	assert.throws(() => lq('employees', { page: '0' }));
	assert.throws(() => lq('employees', { ids: Array.from({ length: 101 }, (_, i) => i + 1).join(',') }));
	assert.throws(() => lq('time_entries', { employee_id: '1 OR 1=1' }));
	assert.throws(() => lq('employees', { sort: 'password' }));
	assert.throws(() => lq('projects', { current_status: "x' OR '1'='1" }));
	assert.equal(lq('employees', { q: "a'; DROP" }).q, 'a DROP');
	assert.throws(() => parseDashboardFilters({ from: '2024-01-01', to: '2026-01-01' }));
	assert.throws(() => trendsQuery({ from: '2026-01-01', to: '2026-06-01' }), { code: 'BAD_REQUEST' }); // > 90 days
	assert.equal(trendsQuery({ from: '2026-08-01', to: '2026-10-01' }).granularity, 'week');
});

test('environment settings are clamped to safe bounds', () => {
	const e = loadEnvironment({ REQUEST_TIMEOUT_MS: '999999', QUERY_BUDGET: '1', IMPORT_BATCH_SIZE: '5000', LOG_LEVEL: 'bogus' });
	assert.equal(e.requestTimeoutMs, 28000);
	assert.equal(e.queryBudget, 5);
	assert.equal(e.importBatchSize, 100);
	assert.equal(e.logLevel, 'info');
});

// ---- scope --------------------------------------------------------------------------------
test('Scope pins managers to their team and lets admins narrow', () => {
	assert.equal(manager.resolveTeam(undefined), '7');
	assert.equal(manager.resolveTeam('7'), '7');
	assert.throws(() => manager.resolveTeam('8'), { status: 403 });
	assert.equal(admin.resolveTeam(undefined), null);
	assert.equal(admin.resolveTeam('9'), '9');
	assert.equal(manager.condition('team_id'), 'team_id = 7');
	assert.equal(admin.condition('team_id'), null);
	assert.throws(() => manager.assertTeam(null), { status: 403 }); // team-less rows are admin-only
	assert.doesNotThrow(() => admin.assertTeam(null));
});

test('requireScope fails closed for bad roles and unassigned managers', () => {
	assert.throws(() => requireScope(null), { status: 403 });
	assert.throws(() => requireScope({ role: 'owner' }), { code: 'INVALID_ROLE' });
	assert.throws(() => requireScope({ role: 'manager', teamId: null }), { code: 'MANAGER_TEAM_MISSING' });
});

// ---- router -------------------------------------------------------------------------------
test('router separates 404 from 405 and exposes health publicly at root and under /api/v1', () => {
	assert.equal(match('GET', '/api/v1/employees/12').params.id, '12');
	assert.equal(match('POST', '/api/v1/time-entries/12/decision').route.method, 'POST');
	assert.equal(match('GET', '/health').route.public, true);
	assert.equal(match('GET', '/api/v1/health').route.public, true);
	assert.throws(() => match('GET', '/api/v1/nope'), { code: 'NOT_FOUND' });
	assert.throws(() => match('PUT', '/api/v1/dashboard/overview'), { code: 'METHOD_NOT_ALLOWED' });
	assert.throws(() => match('GET', '/employees'), { code: 'NOT_FOUND' }); // protected routes only under the prefix
});

// ---- dates --------------------------------------------------------------------------------
test('business dates follow Asia/Kolkata', () => {
	assert.equal(businessToday(new Date('2026-10-13T20:00:00Z')), '2026-10-14');
	assert.equal(businessNow(new Date('2026-10-13T20:00:00Z')), '2026-10-14 01:30:00');
	assert.deepEqual(monthRange('2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
	assert.equal(isValidDate('2026-02-29'), false);
});

// ---- presentations / records / logging / errors -------------------------------------------
test('slide config validation', () => {
	assert.equal(validateSlides([{ type: 'text' }]).errors.length, 0);
	assert.equal(validateSlides([{ type: 'snapshot' }]).errors[0].code, 'INVALID_ID');
	assert.equal(validateSlides([{ type: 'metric' }]).errors[0].code, 'INVALID_VALUE');
	assert.equal(validateSlides('x').errors[0].code, 'INVALID_TYPE');
});

test('match keys: natural keys, source ids, and unsafe characters', () => {
	assert.deepEqual(matchKeyFor(resources.attendance_records, { employee_id: '1', attendance_date: '2026-10-01' }), { column: 'dedupe_key', key: '1|2026-10-01' });
	assert.equal(matchKeyFor(resources.time_entries, { source_record_id: 'S-9' }).key, 'src|S-9');
	assert.equal(matchKeyFor(resources.product_items, { title: 'x' }), null); // needs a source id
	assert.equal(matchKeyFor(resources.employees, { email_normalized: 'a@b.c' }).column, 'email_normalized');
	assert.equal(matchKeyFor(resources.employees, { full_name: 'No Key' }), null);
	assert.match(safeKey("it's|bad"), /^h:[a-f0-9]{64}$/);
	assert.equal(safeKey('1|2026-10-01'), '1|2026-10-01');
});

test('logger redacts personal fields and DB errors are classified without leaking values', () => {
	const lines = [];
	const log = createLogger({ requestId: 'r1' }, 'info', { log: (l) => lines.push(JSON.parse(l)), warn: () => {}, error: () => {} });
	log.info('x', { email: 'a@b.c', full_name: 'Ann', code: 'OK', nested: { reason: 'sick' } });
	assert.equal(lines[0].email, '[redacted]');
	assert.equal(lines[0].full_name, '[redacted]');
	assert.equal(lines[0].nested.reason, '[redacted]');
	assert.equal(lines[0].code, 'OK');
	assert.equal(lines[0].requestId, 'r1');
	const c = classifyDbError(new Error("Duplicate entry 'ann@x.com' for key email"));
	assert.equal(c.error.status, 409);
	assert.doesNotMatch(c.error.message, /ann@x\.com/);
	assert.equal(classifyDbError(new Error('boom: secret detail')).error.message, 'Unexpected server error');
});
