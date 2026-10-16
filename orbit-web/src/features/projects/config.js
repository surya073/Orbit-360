import { defineModule } from '../resources/defineModule';

export const projectsConfig = defineModule({
	title: 'Projects',
	summary: 'projects',
	singular: 'project',
	description: 'Project details: status, timeline, estimated hours and who is assigned to each one.',
	resource: 'projects',
	search: 'Search by project name',
	writable: true,
	importable: true,
	addLabel: 'Add project',
	columns: [
		{ key: 'project_name', label: 'Project' },
		{ key: 'project_code', label: 'Code' },
		{ key: 'team_id', label: 'Team', type: 'fk' },
		{ key: 'project_type', label: 'Type' },
		{ key: 'current_status', label: 'Status', type: 'status' },
		{ key: 'end_date', label: 'End', type: 'date' },
		{ key: 'estimated_hours', label: 'Est. hours', type: 'number' },
		{ key: 'hours_reconciled', label: 'Reconciled hours', type: 'number' },
	],
	emptyMessage: 'Add projects one by one, or import them from the Imports page.',
});

export const assignmentsConfig = defineModule({
	title: 'Assignments',
	resource: 'project_assignments',
	columns: [
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'role_in_project', label: 'Role' },
		{ key: 'allocation_percent', label: 'Allocation %', type: 'number' },
		{ key: 'is_active', label: 'Active', type: 'bool' },
		{ key: 'start_date', label: 'Start', type: 'date' },
		{ key: 'end_date', label: 'End', type: 'date' },
	],
});
