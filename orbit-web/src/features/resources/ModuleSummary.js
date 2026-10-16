import React from 'react';
import CompletenessBadge from '../../components/cards/CompletenessBadge';
import KpiCard from '../../components/cards/KpiCard';
import StackedBar from '../../components/charts/StackedBar';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import { formatNumber, formatPercent, humanize, minutesToHours } from '../../utils/format';
import { resolvePeriod } from '../../utils/periods';

const has = (v) => v !== null && v !== undefined;

/** A wide card under the KPI strip: one proportional bar plus its legend (values come from the backend metric). */
function MixCard({ title, hint, segments, metric }) {
	const total = segments.reduce((s, x) => s + (Number.isFinite(x.value) ? x.value : 0), 0);
	return (
		<section className="card msum__mix" aria-label={title}>
			<div className="msum__mix-head">
				<h2>{title}</h2>
				{metric ? <CompletenessBadge metric={metric} /> : null}
			</div>
			{total > 0 ? <StackedBar ariaLabel={title} segments={segments} /> : <p className="muted small">Nothing recorded for this period yet.</p>}
			{hint ? <p className="small muted msum__mix-hint">{hint}</p> : null}
		</section>
	);
}

/**
 * The summary strip above a module's table (employees, projects, time, attendance, leave). Every number
 * comes from the same backend metrics as the dashboard, for the page's date filter (or this month when
 * none is set), and each card keeps the dashboard look: icon, value, plain-language meaning, a hatched
 * progress bar where there is a share, and a link to the related page.
 */
export default function ModuleSummary({ kind, from, to }) {
	const range = from && to && to >= from ? { from, to } : resolvePeriod({ preset: 'this_month' });
	const wantsProjects = kind === 'projects';
	const overview = useApiResource((signal) => dashboardService.overview(range, { signal }), `sum|${range.from}|${range.to}`, { enabled: !wantsProjects, isEmpty: () => false });
	const projects = useApiResource((signal) => dashboardService.projects(range, { signal }), `sump|${range.from}|${range.to}`, { enabled: wantsProjects, isEmpty: () => false });
	const res = wantsProjects ? projects : overview;
	const o = overview.data;
	const st = { loading: res.status === 'loading' && !res.data, error: res.status === 'error' ? res.error : null };
	const label = ` (${range.from} – ${range.to})`;

	let cards = [];
	let extra = null;
	if (kind === 'time') {
		const t = o && o.time;
		const share = t && has(t.billablePercent) ? t.billablePercent : null;
		cards = [
			<KpiCard key="b" label="Billable hours" icon="clock" unit="h" accent="var(--chart-3)" {...st} value={t ? formatNumber(minutesToHours(t.billableMinutes), 1) : null} sub={share !== null ? `${formatPercent(share)} of approved time` : undefined} metric={t} progress={share !== null ? { value: share } : undefined} hint="Approved entries marked billable." />,
			<KpiCard key="n" label="Non-billable hours" icon="clock" unit="h" accent="var(--chart-2)" {...st} value={t ? formatNumber(minutesToHours(t.nonBillableMinutes), 1) : null} sub={t ? `${t.approvedEntries} approved entries` : undefined} progress={share !== null ? { value: Math.max(0, 100 - share) } : undefined} hint="Approved entries not marked billable." />,
			<KpiCard key="a" label="Approved time" icon="check" unit="h" accent="var(--chart-1)" {...st} value={t ? formatNumber(minutesToHours(t.totalMinutes), 1) : null} sub={t ? `${t.approvedEntries} entries counted` : undefined} hint="Billable plus non-billable." />,
			<KpiCard key="p" label="Awaiting approval" icon="alert" accent="var(--chart-5)" {...st} value={t ? formatNumber(t.excluded.pending) : null} sub={t && t.excluded.rejected ? `${t.excluded.rejected} rejected` : 'Excluded from the totals'} hint="Pending entries do not count until approved." />,
		];
		if (t && t.totalMinutes > 0) extra = <MixCard title="Billable versus non-billable" metric={t} hint="Approved entries only; pending and rejected time is not counted." segments={[{ label: 'Billable', value: t.billableMinutes, color: 'var(--chart-3)', display: `${formatNumber(minutesToHours(t.billableMinutes), 1)} h` }, { label: 'Non-billable', value: t.nonBillableMinutes, color: 'var(--chart-2)', display: `${formatNumber(minutesToHours(t.nonBillableMinutes), 1)} h` }]} />;
	} else if (kind === 'attendance') {
		const a = o && o.attendance;
		cards = [
			<KpiCard key="r" label="Late check-in rate" icon="calendar" accent="var(--chart-5)" {...st} value={a && has(a.lateRatePercent) ? formatPercent(a.lateRatePercent) : null} metric={a} progress={a && has(a.lateRatePercent) ? { value: a.lateRatePercent } : undefined} hint="Late check-ins as a share of records with a known status." />,
			<KpiCard key="o" label="On time" icon="check" accent="var(--chart-3)" {...st} value={a && a.records ? formatNumber(a.onTimeCount) : null} sub={a && a.records ? `of ${a.records} records` : undefined} />,
			<KpiCard key="l" label="Late" icon="clock" accent="var(--chart-2)" {...st} value={a && a.records ? formatNumber(a.lateCount) : null} sub="Stored late status only" />,
			<KpiCard key="u" label="Unknown status" icon="info" accent="var(--chart-6)" {...st} value={a && a.records ? formatNumber(a.unknownCount) : null} sub="Left out of the rate" />,
		];
		if (a && a.records) extra = <MixCard title="Punctuality" metric={a} hint="Unknown status is never counted as on time." segments={[{ label: 'On time', value: a.onTimeCount, color: 'var(--chart-3)' }, { label: 'Late', value: a.lateCount, color: 'var(--chart-2)' }, { label: 'Unknown', value: a.unknownCount, color: 'var(--chart-6)' }]} />;
	} else if (kind === 'leave') {
		const l = o && o.leave;
		const pending = l && l.byStatus ? l.byStatus.requested || 0 : 0;
		cards = [
			<KpiCard key="d" label="Approved leave" icon="calendar" unit="days" accent="var(--chart-6)" {...st} value={l && has(l.approvedDays) ? formatNumber(l.approvedDays, 1) : null} metric={l} hint="Approved leave in days. Hours are shown separately, never added." />,
			<KpiCard key="h" label="Approved hours" icon="clock" unit="h" accent="var(--chart-4)" {...st} value={l && has(l.approvedHours) ? formatNumber(l.approvedHours, 1) : null} sub="Hour-based leave only" />,
			<KpiCard key="q" label="Awaiting decision" icon="alert" accent="var(--chart-5)" {...st} value={l && l.records ? formatNumber(pending) : null} sub="Requests, not days" />,
			<KpiCard key="r" label="Leave records" icon="users" accent="var(--chart-1)" {...st} value={l ? formatNumber(l.records) : null} sub="All statuses in the period" />,
		];
		if (l && l.byStatus && Object.keys(l.byStatus).length) {
			const colors = ['var(--chart-3)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-6)'];
			extra = <MixCard title="Requests by status" metric={l} segments={Object.entries(l.byStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: colors[i % colors.length] }))} />;
		}
	} else if (kind === 'employees') {
		const h = o && o.headcount;
		const by = (h && h.byStatus) || {};
		cards = [
			<KpiCard key="t" label="Employees" icon="users" accent="var(--chart-1)" {...st} value={h && has(h.total) ? formatNumber(h.total) : null} metric={h} hint="Everyone in scope, by employment status." />,
			<KpiCard key="a" label="Active" icon="check" accent="var(--chart-3)" {...st} value={h ? formatNumber(by.active || 0) : null} progress={h && h.total ? { value: ((by.active || 0) / h.total) * 100 } : undefined} sub={h && h.total ? `${formatPercent(((by.active || 0) / h.total) * 100)} of headcount` : undefined} />,
			<KpiCard key="l" label="On leave" icon="calendar" accent="var(--chart-2)" {...st} value={h ? formatNumber(by.on_leave || 0) : null} to={ROUTES.leave} />,
			<KpiCard key="i" label="Inactive" icon="alert" accent="var(--chart-6)" {...st} value={h ? formatNumber(by.inactive || 0) : null} sub="Not currently employed" />,
		];
	} else if (kind === 'projects') {
		const p = projects.data;
		const s = p && p.status;
		const list = (p && p.workload && p.workload.projects) || [];
		const over = list.filter((x) => Number.isFinite(x.burnPercent) && x.burnPercent > 100).length;
		const top = list[0];
		const by = (s && s.byStatus) || {};
		cards = [
			<KpiCard key="t" label="Projects" icon="folder" accent="var(--chart-4)" {...st} value={s && has(s.total) ? formatNumber(s.total) : null} metric={s} hint="Projects in scope by current status." />,
			<KpiCard key="a" label="Active" icon="check" accent="var(--chart-3)" {...st} value={s ? formatNumber(by.active || 0) : null} progress={s && s.total ? { value: ((by.active || 0) / s.total) * 100 } : undefined} sub={s && s.total ? `${by.on_hold || 0} on hold · ${by.completed || 0} completed` : undefined} />,
			<KpiCard key="o" label="Over estimate" icon="alert" accent="var(--chart-5)" {...st} value={p ? formatNumber(over) : null} sub={p ? `of ${list.length} with approved time` : undefined} hint="Lifetime approved hours above the project estimate." />,
			<KpiCard key="b" label="Busiest project" icon="trend" accent="var(--chart-1)" {...st} value={top ? top.name || `#${top.projectId}` : p ? '—' : null} sub={top ? `${formatNumber(minutesToHours(top.periodMinutes), 1)} h approved this period` : undefined} />,
		];
		if (s && s.total) {
			const colors = ['var(--chart-3)', 'var(--chart-2)', 'var(--chart-1)', 'var(--chart-6)'];
			extra = <MixCard title="Projects by status" metric={s} segments={Object.entries(by).map(([k, v], i) => ({ label: humanize(k), value: v, color: colors[i % colors.length] }))} />;
		}
	}
	return (
		<section className="msum" aria-label={`Summary${label}`}>
			<div className="grid grid--kpi" role="group" aria-label="Key figures">
				{cards}
			</div>
			{extra}
			<p className="small muted msum__note">
				{kind === 'employees' ? 'Current headcount by employment status. Same figures as the dashboard.' : `Summary for ${range.from} – ${range.to}. ${kind === 'projects' ? 'Same figures as the dashboard.' : 'Uses the date filters below; this month when none are set.'}`}
			</p>
		</section>
	);
}
