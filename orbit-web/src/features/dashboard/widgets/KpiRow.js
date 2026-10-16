import React from 'react';
import KpiCard from '../../../components/cards/KpiCard';
import { ROUTES } from '../../../config/routes';
import { formatNumber, formatPercent, humanize, minutesToHours } from '../../../utils/format';

const st = (res) => ({ loading: res.status === 'loading' && !res.data, error: res.status === 'error' ? res.error : null });
const nv = (v) => (v === undefined ? null : v); // not_applicable metrics carry no values

/**
 * Six headline KPIs. Each card has its own loading/error state, fed by a backend-computed metric.
 * `trends` (optional) adds sparklines straight from the backend's trend buckets; without it
 * (presentations) the cards are the compact originals.
 */
export default function KpiRow({ overview, projects, trends }) {
	const o = overview.data;
	const p = projects.data;
	const time = o && o.time;
	const att = o && o.attendance;
	const leave = o && o.leave;
	const head = o && o.headcount;
	// the headline statuses first, in a fixed order, then anything else the data holds
	const statusMix = (m, order) => {
		if (!m || !m.byStatus) return undefined;
		const keys = Object.keys(m.byStatus);
		const rank = (k) => (order.includes(k) ? order.indexOf(k) : order.length);
		return keys
			.sort((a, b) => rank(a) - rank(b))
			.slice(0, 3)
			.map((k) => `${m.byStatus[k]} ${humanize(k).toLowerCase()}`)
			.join(' · ');
	};
	const PEOPLE_ORDER = ['active', 'on_leave', 'inactive'];
	const PROJECT_ORDER = ['active', 'on_hold', 'completed'];

	const t = trends && trends.data;
	const series = (rows, key) => (Array.isArray(rows) ? rows.map((r) => (Number.isFinite(r[key]) ? r[key] : null)) : undefined);
	const rich = Boolean(trends);
	const billableShare = time && Number.isFinite(time.billablePercent) ? time.billablePercent : null;

	return (
		<div className="grid grid--kpi" role="group" aria-label="Key metrics">
			<KpiCard label="Employees" icon="users" accent="var(--chart-1)" {...st(overview)} value={head ? (nv(head.total) === null ? null : formatNumber(head.total)) : null} sub={statusMix(head, PEOPLE_ORDER)} metric={head} delay={0} hint={rich ? 'Everyone in scope, by employment status.' : undefined} to={rich ? ROUTES.employees : undefined} />
			<KpiCard label="Projects" icon="folder" accent="var(--chart-4)" {...st(projects)} value={p ? (p.status.total === null ? null : formatNumber(p.status.total)) : null} sub={statusMix(p && p.status, PROJECT_ORDER)} metric={p && p.status} delay={30} hint={rich ? 'Projects in scope by current status.' : undefined} to={rich ? ROUTES.projects : undefined} />
			<KpiCard
				label="Billable hours"
				icon="clock"
				unit="h"
				accent="var(--chart-3)"
				{...st(overview)}
				value={time ? formatNumber(minutesToHours(time.billableMinutes), 1) : null}
				sub={time && time.billablePercent !== null ? `${formatPercent(time.billablePercent)} of approved time` : undefined}
				metric={time}
				delay={60}
				spark={rich && t ? series(t.time, 'billableMinutes') : undefined}
				progress={rich && billableShare !== null ? { value: billableShare } : undefined}
				hint={rich ? 'Approved entries marked billable. Pending entries are excluded.' : undefined}
				to={rich ? ROUTES.time : undefined}
			/>
			<KpiCard
				label="Non-billable hours"
				icon="clock"
				unit="h"
				accent="var(--chart-2)"
				{...st(overview)}
				value={time ? formatNumber(minutesToHours(time.nonBillableMinutes), 1) : null}
				sub={time && time.approvedEntries ? `${time.approvedEntries} approved entries` : undefined}
				delay={90}
				spark={rich && t ? series(t.time, 'nonBillableMinutes') : undefined}
				progress={rich && billableShare !== null ? { value: Math.max(0, 100 - billableShare) } : undefined}
				hint={rich ? 'Approved entries not marked billable.' : undefined}
				to={rich ? ROUTES.time : undefined}
			/>
			<KpiCard
				label="Late check-in rate"
				icon="calendar"
				accent="var(--chart-5)"
				{...st(overview)}
				value={att ? (nv(att.lateRatePercent) === null ? null : formatPercent(att.lateRatePercent)) : null}
				sub={att && att.records ? `${att.lateCount} late of ${att.lateCount + att.onTimeCount} known` : undefined}
				metric={att}
				delay={120}
				spark={rich && t ? series(t.attendance, 'lateRatePercent') : undefined}
				hint={rich ? 'Late check-ins as a share of records with a known status.' : undefined}
				to={rich ? ROUTES.attendance : undefined}
			/>
			<KpiCard
				label="Approved leave"
				icon="calendar"
				unit="days"
				accent="var(--chart-6)"
				{...st(overview)}
				value={leave ? (nv(leave.approvedDays) === null ? null : formatNumber(leave.approvedDays, 1)) : null}
				sub={leave && leave.approvedHours > 0 ? `+ ${formatNumber(leave.approvedHours, 1)} hours` : undefined}
				metric={leave}
				delay={150}
				hint={rich ? 'Approved leave in days. Hours are shown separately, never added.' : undefined}
				to={rich ? ROUTES.leave : undefined}
			/>
		</div>
	);
}
