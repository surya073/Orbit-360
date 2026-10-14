'use strict';

const crypto = require('crypto');
const { f } = require('../validators/schema');

/**
 * Resource registry: the single place describing which Data Store tables are exposed,
 * how they are scoped for managers, what may be filtered/sorted, and what may be written.
 * Table and column names mirror data/database-schema.md exactly.
 *
 * list      - explicit columns (ZCQL allows max 20 columns per SELECT, tables have more)
 * teamColumn- column holding the owning team; managers are always restricted to it
 * scopeVia  - for tables with no team column: managers must filter by a parent row that
 *             belongs to their team (verified server-side)
 * teamFrom  - on create, derive the team from a referenced parent row
 * adminOnly - managers cannot read this resource
 * fields    - writable columns (absent => read-only resource)
 */

const hash = (...parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex');
const uuid = () => crypto.randomUUID();
const TS = ['CREATEDTIME'];

const resources = {
	teams: {
		table: 'teams',
		teamColumn: 'ROWID',
		list: ['ROWID', 'team_code', 'name', 'description', 'is_active', ...TS],
		bools: ['is_active'],
		sortable: ['name', 'team_code', 'CREATEDTIME'],
		defaultSort: ['name', 'asc'],
		search: 'name',
		filters: {},
		fields: {
			team_code: f.str(60, { req: true }),
			name: f.str(150, { req: true }),
			description: f.text(),
			is_active: f.bool(),
		},
		adminWrite: true,
	},
	employees: {
		table: 'employees',
		matchColumns: ['source_record_id', 'email_normalized', 'employee_code'], // import conflict keys
		teamColumn: 'primary_team_id',
		list: ['ROWID', 'employee_code', 'full_name', 'email_normalized', 'job_role', 'joining_date', 'reports_to_employee_id', 'employment_status', 'primary_team_id', ...TS],
		bools: [],
		sortable: ['full_name', 'joining_date', 'CREATEDTIME'],
		defaultSort: ['full_name', 'asc'],
		search: 'full_name',
		filters: { employment_status: 'str', reports_to_employee_id: 'id' },
		fields: {
			employee_code: f.str(60),
			full_name: f.str(200, { req: true }),
			email_normalized: f.str(255, { lower: true }),
			job_role: f.str(120),
			joining_date: f.date(),
			reports_to_employee_id: f.id(),
			employment_status: f.oneOf(['active', 'inactive', 'on_leave', 'unknown']),
			primary_team_id: f.id(),
		},
		sourceSystem: true,
	},
	projects: {
		table: 'projects',
		matchColumns: ['source_record_id', 'project_code'],
		teamColumn: 'team_id',
		list: ['ROWID', 'project_code', 'project_name', 'team_id', 'project_type', 'plan_type', 'region', 'current_status', 'first_start_date', 'end_date', 'completed_date', 'hours_purchased_current', 'estimated_hours', 'hours_reconciled', ...TS],
		bools: [],
		sortable: ['project_name', 'end_date', 'CREATEDTIME'],
		defaultSort: ['project_name', 'asc'],
		search: 'project_name',
		filters: { current_status: 'str', project_type: 'str' },
		fields: {
			project_code: f.str(60),
			project_name: f.str(255, { req: true }),
			team_id: f.id(),
			project_type: f.str(80),
			plan_type: f.str(80),
			region: f.str(80),
			current_status: f.str(60),
			first_start_date: f.date(),
			current_start_date: f.date(),
			end_date: f.date(),
			internal_due_date: f.date(),
			client_due_date: f.date(),
			hours_purchased_current: f.num({ min: 0 }),
			estimated_hours: f.num({ min: 0 }),
			comments: f.text(),
		},
		sourceSystem: true,
	},
	project_assignments: {
		table: 'project_assignments',
		scopeVia: { fk: 'project_id', parent: 'projects' },
		requireScopeFilter: true,
		list: ['ROWID', 'project_id', 'employee_id', 'role_in_project', 'is_second_host', 'allocation_percent', 'contribution_percent_reported', 'is_working', 'start_date', 'end_date', 'is_active', ...TS],
		bools: ['is_second_host', 'is_working', 'is_active'],
		sortable: ['CREATEDTIME', 'start_date'],
		defaultSort: ['CREATEDTIME', 'desc'],
		filters: { project_id: 'id', employee_id: 'id', is_active: 'bool' },
		fields: {
			project_id: f.id({ req: true }),
			employee_id: f.id({ req: true }),
			role_in_project: f.str(120),
			is_second_host: f.bool(),
			allocation_percent: f.num({ min: 0, max: 100 }),
			is_working: f.bool(),
			start_date: f.date(),
			end_date: f.date(),
			is_active: f.bool(),
		},
		dedupe: (v) => `${v.project_id}|${v.employee_id}`,
		sourceSystem: true,
	},
	time_entries: {
		table: 'time_entries',
		sidDedupe: true, // import rows with a source_record_id dedupe on it
		teamColumn: 'team_id',
		dateColumn: 'work_date',
		list: ['ROWID', 'employee_id', 'project_id', 'team_id', 'work_date', 'start_at', 'end_at', 'duration_minutes', 'is_billable', 'work_category', 'work_description', 'approval_status', ...TS],
		bools: ['is_billable'],
		sortable: ['work_date', 'duration_minutes', 'CREATEDTIME'],
		defaultSort: ['work_date', 'desc'],
		filters: { employee_id: 'id', project_id: 'id', is_billable: 'bool', approval_status: 'str' },
		fields: {
			employee_id: f.id({ req: true }),
			project_id: f.id({ req: true }),
			work_date: f.date({ req: true }),
			start_at: f.datetime(),
			end_at: f.datetime(),
			duration_minutes: f.int({ req: true, min: 0, max: 1440 }),
			is_billable: f.bool({ req: true }),
			work_category: f.str(60),
			work_description: f.text(),
		},
		teamFrom: { fk: 'project_id', parent: 'projects', col: 'team_id' },
		parentChecks: [{ fk: 'employee_id', parent: 'employees', col: 'primary_team_id' }],
		defaults: () => ({ approval_status: 'pending' }),
		dedupe: (v) => hash(v.employee_id, v.project_id, v.work_date, v.start_at || '', v.duration_minutes, v.work_description || ''),
		sourceSystem: true,
	},
	attendance_records: {
		table: 'attendance_records',
		teamColumn: 'team_id',
		dateColumn: 'attendance_date',
		list: ['ROWID', 'employee_id', 'team_id', 'attendance_date', 'reporting_month', 'check_in_time_local', 'late_status', 'late_reason', ...TS],
		bools: [],
		sortable: ['attendance_date', 'CREATEDTIME'],
		defaultSort: ['attendance_date', 'desc'],
		filters: { employee_id: 'id', late_status: 'str' },
		fields: {
			employee_id: f.id({ req: true }),
			attendance_date: f.date({ req: true }),
			check_in_time_local: f.str(8),
			late_status: f.oneOf(['yes', 'no', 'unknown'], { req: true }),
			late_reason: f.text(),
		},
		teamFrom: { fk: 'employee_id', parent: 'employees', col: 'primary_team_id' },
		derive: (v) => ({ reporting_month: v.attendance_date ? v.attendance_date.slice(0, 7) : undefined }),
		dedupe: (v) => `${v.employee_id}|${v.attendance_date}`,
		sourceSystem: true,
	},
	leave_records: {
		table: 'leave_records',
		teamColumn: 'team_id',
		dateColumn: 'start_date',
		list: ['ROWID', 'employee_id', 'team_id', 'leave_type', 'start_date', 'end_date', 'units', 'unit_type', 'status', 'reason', ...TS],
		bools: [],
		sortable: ['start_date', 'CREATEDTIME'],
		defaultSort: ['start_date', 'desc'],
		filters: { employee_id: 'id', status: 'str', leave_type: 'str' },
		fields: {
			employee_id: f.id({ req: true }),
			leave_type: f.str(60, { req: true }),
			start_date: f.date({ req: true }),
			end_date: f.date({ req: true }),
			units: f.num({ min: 0 }),
			unit_type: f.oneOf(['days', 'hours']),
			status: f.oneOf(['requested', 'approved', 'rejected', 'cancelled'], { req: true }),
			reason: f.text(),
		},
		teamFrom: { fk: 'employee_id', parent: 'employees', col: 'primary_team_id' },
		dedupe: (v) => `${v.employee_id}|${v.leave_type}|${v.start_date}|${v.end_date}`,
		crossFieldRules: [(v) => (v.start_date && v.end_date && v.end_date < v.start_date ? { field: 'end_date', code: 'INVALID_RANGE', message: 'End date is before start date' } : null)],
		sourceSystem: true,
	},
	metric_definitions: {
		table: 'metric_definitions',
		list: ['ROWID', 'metric_code', 'name', 'module', 'value_type', 'scale_min', 'scale_max', 'weight', 'aggregation', 'is_active'],
		bools: ['is_active'],
		sortable: ['name', 'metric_code'],
		defaultSort: ['name', 'asc'],
		filters: { module: 'str' },
		unscoped: true, // global configuration, readable by both roles
	},
	performance_records: {
		table: 'performance_records',
		teamColumn: 'team_id',
		dateColumn: 'period_start',
		list: ['ROWID', 'employee_id', 'team_id', 'review_cycle', 'period_start', 'period_end', 'metric_definition_id', 'metric_value', 'metric_text', 'metric_scale', 'review_status', ...TS],
		bools: [],
		sortable: ['period_start', 'CREATEDTIME'],
		defaultSort: ['period_start', 'desc'],
		filters: { employee_id: 'id', review_cycle: 'str', review_status: 'str', metric_definition_id: 'id' },
	},
	ai_usage_records: {
		table: 'ai_usage_records',
		teamColumn: 'team_id',
		list: ['ROWID', 'employee_id', 'project_id', 'team_id', 'tool_name', 'tool_category', 'access_type', 'is_shared_access', 'usage_percent_reported', 'usage_purpose', 'reporting_period', ...TS],
		bools: [],
		sortable: ['reporting_period', 'tool_name', 'CREATEDTIME'],
		defaultSort: ['CREATEDTIME', 'desc'],
		search: 'tool_name',
		filters: { employee_id: 'id', project_id: 'id', tool_category: 'str', reporting_period: 'str' },
		fields: {
			employee_id: f.id({ req: true }),
			project_id: f.id(),
			tool_name: f.str(100, { req: true }),
			tool_category: f.oneOf(['ai', 'github', 'other'], { req: true }),
			access_type: f.str(60),
			is_shared_access: f.oneOf(['yes', 'no', 'unknown']),
			usage_percent_reported: f.num({ min: 0, max: 100 }),
			usage_purpose: f.text(),
			reporting_period: f.str(20),
		},
		teamFrom: { fk: 'employee_id', parent: 'employees', col: 'primary_team_id' },
		dedupe: (v) => `${v.employee_id}|${v.tool_name}|${v.project_id || ''}|${v.reporting_period || ''}`,
		sourceSystem: true,
	},
	product_items: {
		table: 'product_items',
		sidDedupe: true,
		randomDedupe: true, // no natural key: imports require source_record_id
		teamColumn: 'team_id',
		list: ['ROWID', 'item_type', 'title', 'project_id', 'team_id', 'status', 'priority', 'assignee_employee_id', 'release_item_id', 'created_on', 'due_date', 'completed_date', 'estimated_hours', 'actual_hours', ...TS],
		bools: [],
		sortable: ['due_date', 'created_on', 'title', 'CREATEDTIME'],
		defaultSort: ['CREATEDTIME', 'desc'],
		search: 'title',
		filters: { item_type: 'str', status: 'str', priority: 'str', project_id: 'id', assignee_employee_id: 'id' },
		fields: {
			item_type: f.oneOf(['task', 'feature', 'bug', 'release', 'milestone'], { req: true }),
			title: f.str(255, { req: true }),
			description: f.text(),
			project_id: f.id(),
			status: f.str(40),
			priority: f.str(20),
			assignee_employee_id: f.id(),
			reporter_employee_id: f.id(),
			parent_item_id: f.id(),
			release_item_id: f.id(),
			created_on: f.date(),
			start_date: f.date(),
			due_date: f.date(),
			completed_date: f.date(),
			estimated_hours: f.num({ min: 0 }),
			actual_hours: f.num({ min: 0 }),
		},
		teamFrom: { fk: 'project_id', parent: 'projects', col: 'team_id', optional: true },
		dedupe: () => `manual|${uuid()}`,
		sourceSystem: true,
	},
	report_snapshots: {
		table: 'report_snapshots',
		teamColumn: 'team_id',
		list: ['ROWID', 'report_type', 'team_id', 'period_start', 'period_end', 'reporting_period', 'status', 'generated_by_user_id', 'generated_at', 'expires_at'],
		bools: [],
		sortable: ['generated_at'],
		defaultSort: ['generated_at', 'desc'],
		filters: { report_type: 'str' },
	},
	import_jobs: {
		table: 'import_jobs',
		teamColumn: 'team_id',
		list: ['ROWID', 'module', 'team_id', 'file_name', 'file_type', 'status', 'total_rows', 'valid_rows', 'invalid_rows', 'conflict_rows', 'created_rows', 'updated_rows', 'failed_rows', 'started_at', 'finished_at', ...TS],
		bools: [],
		sortable: ['CREATEDTIME'],
		defaultSort: ['CREATEDTIME', 'desc'],
		filters: { module: 'str', status: 'str' },
	},
	audit_logs: {
		table: 'audit_logs',
		teamColumn: 'team_id',
		adminOnly: true,
		list: ['ROWID', 'actor_user_id', 'action', 'entity_table', 'entity_row_id', 'team_id', 'reason', 'request_id', ...TS],
		bools: [],
		sortable: ['CREATEDTIME'],
		defaultSort: ['CREATEDTIME', 'desc'],
		filters: { entity_table: 'str', action: 'str', actor_user_id: 'id' },
	},
};

// Tables with soft delete (is_deleted column). Others are filtered without it.
const SOFT_DELETE = new Set(['employees', 'projects', 'project_assignments', 'time_entries', 'attendance_records', 'leave_records', 'performance_records', 'ai_usage_records', 'product_items']);

// Every writable table carries the optional `more_details` JSON column; imports may also
// carry a stable `source_record_id` used for idempotent de-duplication.
for (const [name, r] of Object.entries(resources)) {
	r.name = name;
	r.softDelete = SOFT_DELETE.has(r.table);
	if (r.fields) {
		r.fields.more_details = f.json();
		r.importFields = { ...r.fields, source_record_id: f.str(120) };
		// Time entries may arrive already approved (historical data); default remains pending.
		if (r.table === 'time_entries') r.importFields.approval_status = f.oneOf(['pending', 'approved', 'rejected']);
		// Business-code aliases for foreign keys (resolved by the import service, never stored).
		r.importColumns = ['source_record_id'];
		if (r.fields.employee_id) {
			r.importFields.employee_code = f.str(100);
			r.importColumns.push('employee_code');
		}
		if (r.fields.project_id) {
			r.importFields.project_code = f.str(100);
			r.importColumns.push('project_code');
		}
		if (r.importFields.approval_status) r.importColumns.push('approval_status');
	}
}

module.exports = { resources, SOFT_DELETE };
