import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import StackedBar from '../../../components/charts/StackedBar';
import { colorAt } from '../../../components/charts/scale';
import StatusBadge from '../../../components/common/StatusBadge';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { ROUTES } from '../../../config/routes';
import { formatDate } from '../../../utils/dates';
import { formatNumber, humanize } from '../../../utils/format';

/** Product development: the CURRENT state of work items (not limited to the period). */
export default function ProductStatusCard({ res, drill = false }) {
	const p = res.data && res.data.product;
	const statuses = p ? Object.keys(p.byStatus) : [];
	const color = (status) => colorAt(statuses.indexOf(status)); // one colour per status, in every bar
	const types = p ? Object.entries(p.byType).map(([type, by]) => ({ type, by, total: Object.values(by).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total) : [];
	return (
		<Card
			icon="box"
			accent="var(--chart-2)"
			title="Product development"
			subtitle={res.data ? `Work items by status, as of ${formatDate(res.data.asOf)}` : 'Work items by status'}
			actions={p ? <CompletenessBadge metric={p} /> : null}
		>
			<StateView res={res} loadingHeight={180}>
				{p && p.total === null ? (
					<EmptyState icon="box" title="No product items yet" message="Tasks, features, bugs, releases and milestones appear here once added or imported." />
				) : p ? (
					<div className="stack">
						<div className="stat-tiles">
							<div className="stat-tile">
								<span className="stat-tile__label">Work items</span>
								<b className="stat-tile__value num">{formatNumber(p.total)}</b>
								<span className="small muted">{types.length} {types.length === 1 ? 'type' : 'types'}</span>
							</div>
							<div className={`stat-tile ${p.overdue > 0 ? 'stat-tile--warn' : 'stat-tile--ok'}`}>
								<span className="stat-tile__label">Past due</span>
								<b className="stat-tile__value num">{p.overdue === null ? '—' : formatNumber(p.overdue)}</b>
								{p.overdue > 0 ? <StatusBadge tone="warning" label={`${p.overdue} open past due`} status="overdue" /> : <StatusBadge tone="success" label="No open items past due" status="ok" />}
							</div>
						</div>
						<div>
							<h3 className="block__title">All items by status</h3>
							<StackedBar ariaLabel="Product items by status" segments={statuses.map((s) => ({ label: humanize(s), value: p.byStatus[s], color: color(s) }))} />
						</div>
						<div>
							<h3 className="block__title">By type</h3>
							<ul className="typelist" aria-label="Product items by type">
								{types.map((t) => (
									<li key={t.type} className="typelist__row">
										<span className="typelist__name">{humanize(t.type)}</span>
										<span className="typelist__bar" aria-hidden="true">
											{Object.entries(t.by).map(([status, n]) => (
												<span key={status} title={`${humanize(status)}: ${n}`} style={{ width: `${(n / t.total) * 100}%`, background: color(status) }} />
											))}
										</span>
										<b className="num">{t.total}</b>
										<span className="sr-only">{Object.entries(t.by).map(([s, n]) => `${humanize(s)} ${n}`).join(', ')}</span>
									</li>
								))}
							</ul>
						</div>
						{drill ? (
							<Link to={ROUTES.product} className="card__link">
								Open product development
							</Link>
						) : null}
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
