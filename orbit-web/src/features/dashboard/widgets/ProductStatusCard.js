import React from 'react';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import BarList from '../../../components/charts/BarList';
import { colorAt } from '../../../components/charts/scale';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import StatusBadge from '../../../components/common/StatusBadge';
import { formatDate } from '../../../utils/dates';
import { humanize } from '../../../utils/format';

/** Product development: the CURRENT state of work items (not limited to the period). */
export default function ProductStatusCard({ res }) {
	const p = res.data && res.data.product;
	return (
		<Card
			title="Product development"
			subtitle={res.data ? `Work items by status, as of ${formatDate(res.data.asOf)}` : 'Work items by status'}
			actions={p ? <CompletenessBadge metric={p} /> : null}
		>
			<StateView res={res} loadingHeight={180}>
				{p && p.total === null ? (
					<EmptyState icon="box" title="No product items yet" message="Tasks, features, bugs, releases and milestones appear here once added or imported." />
				) : p ? (
					<div style={{ display: 'grid', gap: 12 }}>
						<BarList ariaLabel="Product items by status" items={Object.entries(p.byStatus).map(([k, v], i) => ({ id: k, label: humanize(k), value: v, color: colorAt(i) }))} />
						<div className="legend" style={{ marginTop: 0 }}>
							{Object.entries(p.byType).map(([type, statuses]) => (
								<span key={type}>
									{humanize(type)} <b className="num" style={{ color: 'var(--text)' }}>{Object.values(statuses).reduce((a, b) => a + b, 0)}</b>
								</span>
							))}
						</div>
						<div>
							{p.overdue > 0 ? <StatusBadge tone="warning" label={`${p.overdue} open past due`} status="overdue" /> : <StatusBadge tone="success" label="No open items past due" status="ok" />}
						</div>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
