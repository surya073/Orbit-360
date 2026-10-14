import React from 'react';
import KpiCard from '../../components/cards/KpiCard';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import { formatNumber, formatPercent, minutesToHours } from '../../utils/format';
import { resolvePeriod } from '../../utils/periods';

/**
 * Totals strip for time / attendance / leave pages. Numbers come from the same backend
 * metrics as the dashboard, for the page's date filter (or this month when none is set).
 */
export default function ModuleSummary({ kind, from, to }) {
	const range = from && to && to >= from ? { from, to } : resolvePeriod({ preset: 'this_month' });
	const res = useApiResource((signal) => dashboardService.overview(range, { signal }), `sum|${range.from}|${range.to}`, { isEmpty: () => false });
	const o = res.data;
	const st = { loading: res.status === 'loading' && !res.data, error: res.status === 'error' ? res.error : null };
	const label = ` (${range.from} – ${range.to})`;

	let cards;
	if (kind === 'time') {
		const t = o && o.time;
		cards = [
			<KpiCard key="b" label="Billable hours" unit="h" {...st} value={t ? formatNumber(minutesToHours(t.billableMinutes), 1) : null} sub={t && t.billablePercent !== null ? `${formatPercent(t.billablePercent)} of approved` : undefined} metric={t} />,
			<KpiCard key="n" label="Non-billable hours" unit="h" {...st} value={t ? formatNumber(minutesToHours(t.nonBillableMinutes), 1) : null} sub={t ? `${t.approvedEntries} approved entries` : undefined} />,
			<KpiCard key="p" label="Awaiting approval" {...st} value={t ? formatNumber(t.excluded.pending) : null} sub="Excluded from the totals" />,
		];
	} else if (kind === 'attendance') {
		const a = o && o.attendance;
		cards = [
			<KpiCard key="r" label="Late check-in rate" {...st} value={a && a.lateRatePercent !== null && a.lateRatePercent !== undefined ? formatPercent(a.lateRatePercent) : null} metric={a} />,
			<KpiCard key="l" label="Late / on time" {...st} value={a && a.records ? `${a.lateCount} / ${a.onTimeCount}` : null} sub={a && a.records ? `${a.records} records` : undefined} />,
			<KpiCard key="u" label="Unknown late status" {...st} value={a && a.records ? formatNumber(a.unknownCount) : null} sub="Left out of the rate" />,
		];
	} else {
		const l = o && o.leave;
		cards = [
			<KpiCard key="d" label="Approved days" unit="days" {...st} value={l && l.approvedDays !== null && l.approvedDays !== undefined ? formatNumber(l.approvedDays, 1) : null} metric={l} />,
			<KpiCard key="h" label="Approved hours" unit="h" {...st} value={l && l.approvedHours !== null && l.approvedHours !== undefined ? formatNumber(l.approvedHours, 1) : null} />,
			<KpiCard key="q" label="Requested (pending)" {...st} value={l && l.records ? formatNumber((l.byStatus && l.byStatus.requested) || 0) : null} sub="Records, not days" />,
		];
	}
	return (
		<section aria-label={`Summary${label}`} style={{ marginBottom: 'var(--space-4)' }}>
			<div className="grid grid--kpi">{cards}</div>
			<p className="small muted" style={{ marginTop: 6 }}>
				Summary for {range.from} – {range.to}. Uses the date filters below; this month when none are set.
			</p>
		</section>
	);
}
