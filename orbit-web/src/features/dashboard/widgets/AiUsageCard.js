import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import ProgressBar from '../../../components/charts/ProgressBar';
import StackedBar from '../../../components/charts/StackedBar';
import { colorAt } from '../../../components/charts/scale';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import ToolLogo from '../../../components/common/ToolLogo';
import { ROUTES } from '../../../config/routes';
import { formatNumber, humanize } from '../../../utils/format';

/** Usage is self-reported; the card says so and never presents it as productivity or billing. */
export default function AiUsageCard({ res, drill = false }) {
	const u = res.data && res.data.usage;
	const max = u ? Math.max(1, ...u.tools.map((t) => t.records)) : 1;
	return (
		<Card icon="sparkles" accent="var(--chart-4)" title="AI and GitHub usage" subtitle="Reported usage records per tool, for the reporting months in range" actions={u ? <CompletenessBadge metric={u} /> : null}>
			<StateView res={res} loadingHeight={180}>
				{u && u.totalRecords === null ? (
					<EmptyState icon="sparkles" title="No usage reported for this period" message="Usage records carry a reporting month (YYYY-MM); records without one are not included." />
				) : u ? (
					<div className="ai">
						<div className="ai__summary">
							<div className="stat-tiles">
								<div className="stat-tile">
									<span className="stat-tile__label">Usage records</span>
									<b className="stat-tile__value num">{formatNumber(u.totalRecords)}</b>
									<span className="small muted">self-reported</span>
								</div>
								<div className="stat-tile">
									<span className="stat-tile__label">Tools</span>
									<b className="stat-tile__value num">{formatNumber(u.toolCount ?? u.tools.length)}</b>
									<span className="small muted">
										{Object.keys(u.byCategory).length} {Object.keys(u.byCategory).length === 1 ? 'category' : 'categories'}
									</span>
								</div>
							</div>
							<StackedBar ariaLabel="Usage records by category" segments={Object.entries(u.byCategory).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) }))} />
							<p className="small muted">Percentages are self-reported and are not a productivity or billing measure.{u.missingPeriod > 0 ? ` ${u.missingPeriod} records without a reporting period are excluded.` : ''}</p>
							{drill ? (
								<Link to={ROUTES.usage} className="card__link">
									Open usage records
								</Link>
							) : null}
						</div>
						<ul className="toollist" aria-label="Usage records by tool">
							{u.tools.slice(0, 6).map((t, i) => (
								<li key={`${t.tool}-${t.category}`} className="toollist__row">
									<span className="toollist__name" title={t.tool}>
										<ToolLogo name={t.tool} />
										<span>{t.tool}</span>
										<small>{humanize(t.category)}</small>
									</span>
									<ProgressBar value={t.records} max={max} color={colorAt(i)} />
									<b className="num">{t.records}</b>
									<span className="small muted toollist__pct">{t.avgReportedPercent === null ? 'no % reported' : `avg ${formatNumber(t.avgReportedPercent, 0)}% reported`}</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
