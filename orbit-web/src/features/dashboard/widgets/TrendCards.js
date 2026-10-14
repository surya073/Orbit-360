import React from 'react';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import LineChart from '../../../components/charts/LineChart';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { formatDate } from '../../../utils/dates';
import { formatNumber, minutesToHours } from '../../../utils/format';

const label = (d) => formatDate(d).slice(0, 6);

export function BillableTrendCard({ res, clamped, minimal }) {
	const points = res.data && res.data.time;
	const data = (points || []).map((p) => ({ x: p.start, label: label(p.start), billable: minutesToHours(p.billableMinutes), nonBillable: minutesToHours(p.nonBillableMinutes) }));
	const partial = (points || []).some((p) => p.completeness === 'partial');
	return (
		<Card
			title="Billable vs non-billable hours"
			subtitle={res.data ? `Approved time, per ${res.data.filters.granularity}${clamped ? ' · most recent 90 days of the period' : ''}` : 'Approved time only'}
			actions={partial ? <CompletenessBadge metric={{ completeness: 'partial', missing: 'pending_approval' }} /> : null}
		>
			<StateView res={res} loadingHeight={220}>
				{data.length === 0 ? (
					<EmptyState icon="trend" title="No approved time in this period" message="Approve or import time entries to see the trend. Periods with no data are left blank, not shown as zero." />
				) : (
					<>
						<LineChart
							data={data}
							height={220}
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

export function AttendanceTrendCard({ res }) {
	const att = res.data && res.data.attendance;
	const notApplicable = att && att.completeness === 'not_applicable';
	const data = Array.isArray(att) ? att.map((p) => ({ x: p.start, label: label(p.start), rate: p.lateRatePercent })) : [];
	const partial = Array.isArray(att) && att.some((p) => p.completeness === 'partial');
	return (
		<Card title="Late check-ins" subtitle="Share of recorded check-ins that were late" actions={partial ? <CompletenessBadge metric={{ completeness: 'partial', missing: 'late_status_unknown' }} /> : null}>
			<StateView res={res} loadingHeight={220}>
				{notApplicable ? (
					<EmptyState icon="info" title="Not available for this selection" message={att.reason} />
				) : data.length === 0 ? (
					<EmptyState icon="calendar" title="No attendance recorded in this period" message="Missing attendance is shown as no data, not as zero late check-ins." />
				) : (
					<LineChart data={data} height={220} area ariaLabel="Late check-in rate over time" yFormat={(v) => `${formatNumber(v, 0)}%`} series={[{ key: 'rate', label: 'Late rate', color: 'var(--chart-5)' }]} />
				)}
			</StateView>
		</Card>
	);
}
