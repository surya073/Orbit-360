import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import RingGauge from '../../../components/charts/RingGauge';
import StackedBar from '../../../components/charts/StackedBar';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { ROUTES } from '../../../config/routes';
import { formatMinutes, formatNumber, formatPercent } from '../../../utils/format';

/**
 * Where approved time goes. Every figure is a field of the backend's time metric: billable and
 * non-billable minutes, the billable share, approved entry count, and the pending / rejected
 * entries that are deliberately left out of every total.
 */
export default function TimeBreakdownCard({ res }) {
	const t = res.data && res.data.time;
	const empty = t && t.completeness === 'insufficient_data';
	const excluded = (t && t.excluded) || { pending: 0, rejected: 0 };
	return (
		<Card icon="clock" accent="var(--chart-3)" title="Where approved time goes" subtitle="Billable versus non-billable, and what is not counted yet" actions={t ? <CompletenessBadge metric={t} /> : null}>
			<StateView res={res} loadingHeight={190}>
				{empty && excluded.pending === 0 && excluded.rejected === 0 ? (
					<EmptyState icon="clock" title="No approved time to break down" message="Time entries count here once they are approved." />
				) : t ? (
					<div className="split">
						<div className="split__ring">
							<RingGauge value={Number.isFinite(t.billablePercent) ? t.billablePercent : null} caption="billable" color="var(--chart-3)" size={128} ariaLabel="Billable share of approved time" />
						</div>
						<div className="split__body">
							<dl className="stats">
								<div>
									<dt>Approved time</dt>
									<dd className="num">{formatMinutes(t.totalMinutes)}</dd>
								</div>
								<div>
									<dt>Approved entries</dt>
									<dd className="num">{formatNumber(t.approvedEntries)}</dd>
								</div>
								<div>
									<dt>Billable share</dt>
									<dd className="num">{formatPercent(t.billablePercent)}</dd>
								</div>
							</dl>
							{Number.isFinite(t.totalMinutes) ? (
								<StackedBar
									ariaLabel="Approved time by billing"
									segments={[
										{ label: 'Billable', value: t.billableMinutes, display: formatMinutes(t.billableMinutes), color: 'var(--chart-3)' },
										{ label: 'Non-billable', value: t.nonBillableMinutes, display: formatMinutes(t.nonBillableMinutes), color: 'var(--chart-2)' },
									]}
								/>
							) : null}
						</div>
						<div className="split__aside">
							<h3 className="aside__title">Not counted in these totals</h3>
							<ul className="aside__list">
								<li className={excluded.pending > 0 ? 'is-warn' : ''}>
									<b className="num">{formatNumber(excluded.pending)}</b> pending approval
									{excluded.pending > 0 ? (
										<Link to={ROUTES.time} className="aside__link">
											Review
										</Link>
									) : null}
								</li>
								<li>
									<b className="num">{formatNumber(excluded.rejected)}</b> rejected
								</li>
							</ul>
							<p className="small muted">Only approved entries count toward billable and non-billable hours.</p>
						</div>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
