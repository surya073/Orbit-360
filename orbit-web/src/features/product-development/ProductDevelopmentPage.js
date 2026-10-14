import React from 'react';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import ProductStatusCard from '../dashboard/widgets/ProductStatusCard';
import { defineModule } from '../resources/defineModule';
import ResourcePage from '../resources/ResourcePage';

export const productConfig = defineModule({
	title: 'Product development',
	singular: 'work item',
	description: 'Tasks, features, bugs, releases and milestones',
	resource: 'product_items',
	search: 'Search by title',
	writable: true,
	importable: true,
	addLabel: 'Add work item',
	columns: [
		{ key: 'item_type', label: 'Type', type: 'status' },
		{ key: 'title', label: 'Title' },
		{ key: 'project_id', label: 'Project', type: 'fk' },
		{ key: 'status', label: 'Status', type: 'status' },
		{ key: 'priority', label: 'Priority' },
		{ key: 'assignee_employee_id', label: 'Assignee', type: 'fk' },
		{ key: 'due_date', label: 'Due', type: 'date' },
		{ key: 'completed_date', label: 'Completed', type: 'date' },
	],
	filters: [
		{ key: 'item_type', label: 'Type', options: ['task', 'feature', 'bug', 'release', 'milestone'] },
		{ key: 'priority', label: 'Priority', options: ['low', 'medium', 'high', 'critical'] },
	],
});

function Summary() {
	// Product status is a current-state snapshot; the backend ignores the period for it.
	const res = useApiResource((signal) => dashboardService.product({}, { signal }), 'product-summary', { isEmpty: () => false });
	return (
		<div style={{ marginBottom: 'var(--space-4)' }}>
			<ProductStatusCard res={res} />
		</div>
	);
}

export default function ProductDevelopmentPage() {
	return <ResourcePage config={productConfig} topSlot={<Summary />} />;
}
