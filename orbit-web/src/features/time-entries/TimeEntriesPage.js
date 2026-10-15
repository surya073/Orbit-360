import React from 'react';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const timeEntriesConfig = defineModule({
	title: 'Time entries',
	singular: 'time entry',
	description: 'Work logged against projects. Only approved entries count toward billable and non-billable totals.',
	resource: 'time_entries',
	search: 'Search by employee, project or category',
	dateRange: true,
	writable: true,
	importable: true,
	approvals: true,
	summary: 'time',
	addLabel: 'Add time entry',
	columns: [
		{ key: 'work_date', label: 'Date', type: 'date' },
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'project_id', label: 'Project', type: 'fk' },
		{ key: 'duration_minutes', label: 'Duration', type: 'minutes' },
		{ key: 'is_billable', label: 'Billable', type: 'bool' },
		{ key: 'approval_status', label: 'Approval', type: 'status' },
		{ key: 'work_description', label: 'Description' },
	],
	filters: [
		{ key: 'approval_status', label: 'Approval', options: ['pending', 'approved', 'rejected'] },
		{ key: 'is_billable', label: 'Billable', options: ['true', 'false'] },
	],
	emptyMessage: 'Log time against a project, or import entries from the Imports page. New entries start as pending until approved.',
});

export default function TimeEntriesPage() {
	return <ResourcePage config={timeEntriesConfig} />;
}
