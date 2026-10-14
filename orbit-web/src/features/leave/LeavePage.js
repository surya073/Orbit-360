import React from 'react';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const leaveConfig = defineModule({
	title: 'Leave',
	singular: 'leave record',
	description: 'Leave requests and approvals. Days and hours are reported separately.',
	resource: 'leave_records',
	dateRange: true,
	writable: true,
	importable: true,
	summary: 'leave',
	addLabel: 'Add leave',
	columns: [
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'leave_type', label: 'Type' },
		{ key: 'start_date', label: 'From', type: 'date' },
		{ key: 'end_date', label: 'To', type: 'date' },
		{ key: 'units', label: 'Units', type: 'number' },
		{ key: 'unit_type', label: 'Unit' },
		{ key: 'status', label: 'Status', type: 'status' },
	],
	filters: [{ key: 'status', label: 'Status', options: ['requested', 'approved', 'rejected', 'cancelled'] }],
});

export default function LeavePage() {
	return <ResourcePage config={leaveConfig} />;
}
