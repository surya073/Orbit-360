import React from 'react';
import KpiCard from '../../../components/cards/KpiCard';
import { formatNumber, formatPercent, humanize, minutesToHours } from '../../../utils/format';

const st = (res) => ({ loading: res.status === 'loading' && !res.data, error: res.status === 'error' ? res.error : null });
const nv = (v) => (v === undefined ? null : v); // not_applicable metrics carry no values

/** Six headline KPIs. Each card has its own loading/error state, fed by a backend-computed metric. */
export default function KpiRow({ overview, projects }) {
	const o = overview.data;
	const p = projects.data;
	const time = o && o.time;
	const att = o && o.attendance;
	const leave = o && o.leave;
	const head = o && o.headcount;
	const statusMix = (m) =>
		m && m.byStatus
			? Object.entries(m.byStatus)
					.slice(0, 3)
					.map(([k, v]) => `${v} ${humanize(k).toLowerCase()}`)
					.join(' · ')
			: undefined;

	return (
		<div className="grid grid--kpi" role="group" aria-label="Key metrics">
			<KpiCard label="Employees" icon="users" {...st(overview)} value={head ? (nv(head.total) === null ? null : formatNumber(head.total)) : null} sub={statusMix(head)} metric={head} delay={0} />
			<KpiCard label="Projects" icon="folder" {...st(projects)} value={p ? (p.status.total === null ? null : formatNumber(p.status.total)) : null} sub={statusMix(p && p.status)} metric={p && p.status} delay={30} />
			<KpiCard label="Billable hours" icon="clock" unit="h" {...st(overview)} value={time ? formatNumber(minutesToHours(time.billableMinutes), 1) : null} sub={time && time.billablePercent !== null ? `${formatPercent(time.billablePercent)} of approved time` : undefined} metric={time} delay={60} />
			<KpiCard label="Non-billable hours" icon="clock" unit="h" {...st(overview)} value={time ? formatNumber(minutesToHours(time.nonBillableMinutes), 1) : null} sub={time && time.approvedEntries ? `${time.approvedEntries} approved entries` : undefined} delay={90} />
			<KpiCard label="Late check-in rate" icon="calendar" {...st(overview)} value={att ? (nv(att.lateRatePercent) === null ? null : formatPercent(att.lateRatePercent)) : null} sub={att && att.records ? `${att.lateCount} late of ${att.lateCount + att.onTimeCount} known` : undefined} metric={att} delay={120} />
			<KpiCard label="Approved leave" icon="calendar" unit="days" {...st(overview)} value={leave ? (nv(leave.approvedDays) === null ? null : formatNumber(leave.approvedDays, 1)) : null} sub={leave && leave.approvedHours > 0 ? `+ ${formatNumber(leave.approvedHours, 1)} hours` : undefined} metric={leave} delay={150} />
		</div>
	);
}
