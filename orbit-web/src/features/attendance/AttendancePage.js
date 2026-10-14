import React from 'react';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const attendanceConfig = defineModule({
	title: 'Attendance',
	singular: 'attendance record',
	description: 'Daily check-ins. Check-in time and late status are kept separate; an unknown status is never treated as on time.',
	resource: 'attendance_records',
	dateRange: true,
	writable: true,
	importable: true,
	summary: 'attendance',
	addLabel: 'Add attendance',
	columns: [
		{ key: 'attendance_date', label: 'Date', type: 'date' },
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'check_in_time_local', label: 'Check-in (IST)' },
		{ key: 'late_status', label: 'Late', type: 'status' },
		{ key: 'late_reason', label: 'Reason' },
	],
	filters: [{ key: 'late_status', label: 'Late status', options: ['yes', 'no', 'unknown'] }],
});

export default function AttendancePage() {
	return <ResourcePage config={attendanceConfig} />;
}
