import React from 'react';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import LineChart from '../../../components/charts/LineChart';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { formatDate } from '../../../utils/dates';
import { formatNumber, minutesToHours } from '../../../utils/format';

const label = (d) => formatDate(d).slice(0, 6);

/** Direct readings of the chart's own points: the latest period and the highest one. No new calculations. */
function Highlights({ items }) {
	const shown = items.filter(Boolean);
	if (!shown.length) return null;
	return (
		<dl className="stats stats--chips" aria-label="Chart highlights">
			{shown.map((i) => (
				<div key={i.label}>
					<dt>{i.label}</dt>
					<dd className="num">{i.value}</dd>
					<span className="small muted">{i.sub}</span>
				</div>
			))}
		</dl>
	);
}

export function BillableTrendCard({ res, clamped, minimal, highlights = false }) {
	const points = res.data && res.data.time;
	const data = (points || []).map((p) => ({ x: p.start, label: label(p.start), billable: minutesToHours(p.billableMinutes), nonBillable: minutesToHours(p.nonBillableMinutes) }));
	const partial = (points || []).some((p) => p.completeness === 'partial');
	return (
		<Card
			icon="trend"
			accent="var(--chart-3)"
			title="Billable vs non-billable hours"
			subtitle={res.data ? `Approved time, per ${res.data.filters.granularity}${clamped ? ' · most recent 90 days of the period' : ''}` : 'Approved time only'}
			actions={partial ? <CompletenessBadge metric={{ completeness: 'partial', missing: 'pending_approval' }} /> : null}
		>
			<StateView res={res} loadingHeight={220}>
				{data.length === 0 ? (
					<EmptyState icon="trend" title="No approved time in this period" message="Approve or import time entries to see the trend. Periods with no data are left blank, not shown as zero." />
				) : (
					<>
						{highlights ? (
							<Highlights
								items={[
									data.length ? { label: 'Latest period', value: `${formatNumber(data[data.length - 1].billable, 1)}h`, sub: `billable, ${data[data.length - 1].label}` } : null,
									data.some((d) => Number.isFinite(d.billable))
										? (() => {
												const peak = data.reduce((m, d) => (Number.isFinite(d.billable) && (!m || d.billable > m.billable) ? d : m), null);
												return { label: 'Peak period', value: `${formatNumber(peak.billable, 1)}h`, sub: `billable, ${peak.label}` };
										  })()
										: null,
								]}
							/>
						) : null}
						<LineChart
							data={data}
							height={220}
							area
							ariaLabel="Billable and non-billable hours over time"
							yFormat={(v) => `${formatNumber(v, 1)}h`}
							series={[
								{ key: 'billable', label: 'Billable', color: 'var(--chart-1)' },
								{ key: 'nonBillable', label: 'Non-billable', color: 'var(--chart-2)' },
							]}
						/>
						{res.data.truncated && !minimal ? <p className="small muted">Result reached the query limit; some days may be missing.</p> : null}
					</>
				)}
			</StateView>
		</Card>
	);
}

export function AttendanceTrendCard({ res, highlights = false }) {
	const att = res.data && res.data.attendance;
	const notApplicable = att && att.completeness === 'not_applicable';
	const data = Array.isArray(att) ? att.map((p) => ({ x: p.start, label: label(p.start), rate: p.lateRatePercent })) : [];
	const partial = Array.isArray(att) && att.some((p) => p.completeness === 'partial');
	return (
		<Card icon="calendar" accent="var(--chart-5)" title="Late check-ins" subtitle="Share of recorded check-ins that were late" actions={partial ? <CompletenessBadge metric={{ completeness: 'partial', missing: 'late_status_unknown' }} /> : null}>
			<StateView res={res} loadingHeight={220}>
				{notApplicable ? (
					<EmptyState icon="info" title="Not available for this selection" message={att.reason} />
				) : data.length === 0 ? (
					<EmptyState icon="calendar" title="No attendance recorded in this period" message="Missing attendance is shown as no data, not as zero late check-ins." />
				) : (
					<>
						{highlights ? (
							<Highlights
								items={[
									{ label: 'Latest period', value: Number.isFinite(data[data.length - 1].rate) ? `${formatNumber(data[data.length - 1].rate, 0)}%` : '—', sub: `late, ${data[data.length - 1].label}` },
									data.some((d) => Number.isFinite(d.rate))
										? (() => {
												const peak = data.reduce((m, d) => (Number.isFinite(d.rate) && (!m || d.rate > m.rate) ? d : m), null);
												return { label: 'Highest period', value: `${formatNumber(peak.rate, 0)}%`, sub: `late, ${peak.label}` };
										  })()
										: null,
								]}
							/>
						) : null}
						<LineChart data={data} height={220} area ariaLabel="Late check-in rate over time" yFormat={(v) => `${formatNumber(v, 0)}%`} series={[{ key: 'rate', label: 'Late rate', color: 'var(--chart-5)' }]} />
					</>
				)}
			</StateView>
		</Card>
	);
}
