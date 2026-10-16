import React from 'react';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const performanceConfig = defineModule({
	title: 'Performance reviews',
	description: 'Review scores for each person, by metric and review cycle.',
	resource: 'performance_records',
	search: 'Search by employee or review cycle',
	dateRange: true,
	note: 'Records are shown as stored. No overall score is calculated: scores need configured metric definitions and weights.',
	columns: [
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'review_cycle', label: 'Cycle' },
		{ key: 'period_start', label: 'From', type: 'date' },
		{ key: 'period_end', label: 'To', type: 'date' },
		{ key: 'metric_value', label: 'Value', type: 'number' },
		{ key: 'metric_text', label: 'Text' },
		{ key: 'review_status', label: 'Review', type: 'status' },
	],
	filters: [{ key: 'review_status', label: 'Review', options: ['draft', 'submitted', 'finalized'] }],
	emptyMessage: 'No performance records have been recorded for your scope yet.',
});

export default function PerformancePage() {
	return <ResourcePage config={performanceConfig} />;
}
