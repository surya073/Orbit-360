import React, { useState } from 'react';
import DateRangeFilter, { isValidPeriod } from '../../components/filters/DateRangeFilter';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import { resolvePeriod } from '../../utils/periods';
import AiUsageCard from '../dashboard/widgets/AiUsageCard';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const aiUsageConfig = defineModule({
	title: 'AI & GitHub tool usage',
	singular: 'usage record',
	description: 'Which AI and GitHub tools people use, and how much, as reported by employees.',
	resource: 'ai_usage_records',
	search: 'Search by tool name',
	writable: true,
	importable: true,
	addLabel: 'Add usage',
	note: 'Usage percentages are self-reported. They are not a productivity or billing measure.',
	columns: [
		{ key: 'employee_id', label: 'Employee', type: 'fk' },
		{ key: 'tool_name', label: 'Tool' },
		{ key: 'tool_category', label: 'Category', type: 'status' },
		{ key: 'usage_percent_reported', label: 'Reported usage', type: 'percent' },
		{ key: 'reporting_period', label: 'Period' },
		{ key: 'usage_purpose', label: 'Purpose' },
	],
	filters: [{ key: 'tool_category', label: 'Category', options: ['ai', 'github', 'other'] }],
});

function Summary() {
	const [period, setPeriod] = useState({ preset: 'this_quarter' });
	const valid = isValidPeriod(period);
	const range = valid ? resolvePeriod(period) : null;
	const res = useApiResource((signal) => dashboardService.aiUsage(range, { signal }), `aiu|${JSON.stringify(range)}`, { enabled: valid, isEmpty: () => false });
	return (
		<div style={{ marginBottom: 'var(--space-4)' }}>
			<div className="filter-bar">
				<DateRangeFilter label="Summary period" value={period} onChange={setPeriod} />
			</div>
			<AiUsageCard res={res} />
		</div>
	);
}

export default function AiUsagePage() {
	return <ResourcePage config={aiUsageConfig} topSlot={<Summary />} />;
}
