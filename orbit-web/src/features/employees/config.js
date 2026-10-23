import { defineModule } from '../resources/defineModule';

export const employeesConfig = defineModule({
	title: 'Employees',
	summary: 'employees',
	singular: 'employee',
	viewLabel: 'View profile',
	description: 'Your people directory: who works here, in which team and role, and their employment status.',
	resource: 'employees',
	search: 'Search by name',
	writable: true,
	importable: true,
	addLabel: 'Add employee',
	columns: [
		{ key: 'full_name', label: 'Name' },
		{ key: 'employee_code', label: 'Code' },
		{ key: 'email_normalized', label: 'Email' },
		{ key: 'job_role', label: 'Role' },
		{ key: 'primary_team_id', label: 'Team', type: 'fk' },
		{ key: 'employment_status', label: 'Status', type: 'status' },
		{ key: 'joining_date', label: 'Joined', type: 'date' },
	],
	filters: [{ key: 'employment_status', label: 'Status', options: ['active', 'inactive', 'on_leave', 'unknown'] }],
	emptyMessage: 'Add employees one by one, or import a CSV from the Imports page.',
});
