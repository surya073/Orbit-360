import React, { useMemo } from 'react';
import Card from '../../../components/cards/Card';
import Icon from '../../../components/common/Icon';
import LoadingState from '../../../components/feedback/LoadingState';
import { computeInsights } from '../../../utils/insights';

const ICON = { warning: 'alert', success: 'check', info: 'info' };

/** Findings computed from the metrics already loaded (no extra requests). */
export default function InsightsCard({ overview, projects, product, freshness, bare }) {
	const ready = [overview, projects, product, freshness].some((r) => r.data);
	const loading = [overview, projects, product, freshness].every((r) => r.status === 'loading' && !r.data);
	const items = useMemo(() => computeInsights({ overview: overview.data, projects: projects.data, product: product.data, freshness: freshness.data }), [overview.data, projects.data, product.data, freshness.data]);
	const body = loading ? (
		<LoadingState lines={3} />
	) : !ready ? (
		<p className="muted small">Insights are unavailable until at least one data source loads.</p>
	) : (
		<ul className="insights">
			{items.map((i) => (
				<li key={i.id} className={`insight insight--${i.tone}`}>
					<Icon name={ICON[i.tone]} size={15} />
					<div>
						<div className="insight__title">{i.title}</div>
						{i.detail ? <div className="small muted">{i.detail}</div> : null}
					</div>
				</li>
			))}
		</ul>
	);
	return bare ? body : <Card title="Key insights" subtitle="Plain statements from the numbers above">{body}</Card>;
}
