import React from 'react';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import BarList from '../../../components/charts/BarList';
import StackedBar from '../../../components/charts/StackedBar';
import { colorAt } from '../../../components/charts/scale';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { formatNumber, humanize } from '../../../utils/format';

/** Usage is self-reported; the card says so and never presents it as productivity or billing. */
export default function AiUsageCard({ res }) {
	const u = res.data && res.data.usage;
	return (
		<Card title="AI and GitHub usage" subtitle="Reported usage records per tool, for the reporting months in range" actions={u ? <CompletenessBadge metric={u} /> : null}>
			<StateView res={res} loadingHeight={180}>
				{u && u.totalRecords === null ? (
					<EmptyState icon="sparkles" title="No usage reported for this period" message="Usage records carry a reporting month (YYYY-MM); records without one are not included." />
				) : u ? (
					<div style={{ display: 'grid', gap: 12 }}>
						<StackedBar ariaLabel="Usage records by category" segments={Object.entries(u.byCategory).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) }))} />
						<BarList
							ariaLabel="Usage records by tool"
							items={u.tools.slice(0, 6).map((t, i) => ({ id: `${t.tool}-${t.category}`, label: t.tool, value: t.records, note: t.avgReportedPercent === null ? '· no % reported' : `· avg ${formatNumber(t.avgReportedPercent, 0)}% reported`, color: colorAt(i) }))}
						/>
						<p className="small muted">Percentages are self-reported and are not a productivity or billing measure.{u.missingPeriod > 0 ? ` ${u.missingPeriod} records without a reporting period are excluded.` : ''}</p>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
