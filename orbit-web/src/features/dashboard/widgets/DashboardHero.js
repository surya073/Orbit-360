import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import RingGauge from '../../../components/charts/RingGauge';
import Icon from '../../../components/common/Icon';
import { formatDate, formatDateTime } from '../../../utils/dates';
import { formatMinutes, formatNumber, formatPercent } from '../../../utils/format';
import { computeInsights } from '../../../utils/insights';
import { daysSince, presetLabel } from '../../../utils/periods';
import { insightLink } from '../insightLinks';

const ageTone = (date) => {
	if (!date) return 'muted';
	const n = daysSince(date);
	return n <= 2 ? 'ok' : n > 7 ? 'warn' : 'muted';
};
const ageText = (date) => {
	if (!date) return 'none yet';
	const n = daysSince(date);
	return `${formatDate(date)}${n > 0 ? ` (${n}d ago)` : ' (today)'}`;
};

function Chip({ icon, tone = 'muted', children }) {
	return (
		<span className={`hero__chip hero__chip--${tone}`}>
			{icon ? <Icon name={icon} size={12} /> : null}
			{children}
		</span>
	);
}

/**
 * Top of the dashboard: the period and how current the data is, the two headline rates as gauges,
 * and anything the backend metrics flag as needing attention (each one links to where it is
 * handled). Everything is read from metrics already loaded for the widgets below, no extra requests.
 */
export default function DashboardHero({ period, preset, overview, projects, product, freshness, actions }) {
	const o = overview.data;
	const fr = freshness.data;
	const time = o && o.time;
	const att = o && o.attendance;

	const flags = useMemo(() => computeInsights({ overview: o, projects: projects.data, product: product.data, freshness: fr }).filter((i) => i.tone === 'warning'), [o, projects.data, product.data, fr]);
	const anyLoaded = [overview, projects, product, freshness].some((r) => r.data);
	const allSettled = [overview, projects, product, freshness].every((r) => r.status !== 'loading' || r.data);

	const summary =
		time && time.totalMinutes > 0
			? `${formatMinutes(time.totalMinutes)} of approved time across ${formatNumber(time.approvedEntries)} entries${time.billablePercent !== null ? `, ${formatPercent(time.billablePercent)} billable` : ''}.`
			: overview.status === 'loading' && !o
			? 'Loading the latest figures…'
			: 'No approved time in this selection yet.';

	return (
		<section className="hero" aria-label="Overview summary">
			<div className="hero__main">
				<div className="hero__top">
					<div>
						<p className="hero__eyebrow">
							<Icon name="dashboard" size={13} /> Executive overview
						</p>
						<h1 className="hero__title">Overview</h1>
						<p className="hero__lede">{summary}</p>
					</div>
					{actions ? <div className="hero__actions">{actions}</div> : null}
				</div>
				<div className="hero__chips" aria-label="Period and data freshness">
					{period ? (
						<Chip icon="calendar" tone="accent">
							{presetLabel(preset)} · {formatDate(period.from)} – {formatDate(period.to)} · IST
						</Chip>
					) : null}
					{freshness.status === 'error' ? (
						<Chip tone="warn">Freshness unavailable</Chip>
					) : fr ? (
						<>
							<Chip icon="clock" tone={ageTone(fr.timeEntries.latestDate)}>
								Time entries: {ageText(fr.timeEntries.latestDate)}
							</Chip>
							<Chip icon="check" tone={ageTone(fr.attendance.latestDate)}>
								Attendance: {ageText(fr.attendance.latestDate)}
							</Chip>
							<Chip icon="upload">Last import: {fr.imports.lastCompletedAt ? formatDateTime(fr.imports.lastCompletedAt) : 'none yet'}</Chip>
						</>
					) : (
						<Chip>Checking data freshness…</Chip>
					)}
				</div>
				<div className="hero__flags" aria-label="Needs attention">
					{flags.length > 0 ? (
						flags.slice(0, 5).map((f) => {
							const to = insightLink(f.id);
							const body = (
								<>
									<Icon name="alert" size={13} />
									<span>{f.title}</span>
									{to ? <Icon name="chevronRight" size={12} /> : null}
								</>
							);
							return to ? (
								<Link key={f.id} className="flag flag--warning" to={to} title={f.detail || undefined}>
									{body}
								</Link>
							) : (
								<span key={f.id} className="flag flag--warning" title={f.detail || undefined}>
									{body}
								</span>
							);
						})
					) : anyLoaded && allSettled ? (
						<span className="flag flag--ok">
							<Icon name="check" size={13} />
							<span>Nothing flagged for this selection</span>
						</span>
					) : null}
				</div>
			</div>
			<div className="hero__gauges">
				<div className="hero__gauge">
					<RingGauge value={time && Number.isFinite(time.billablePercent) ? time.billablePercent : null} caption="billable" color="var(--chart-3)" ariaLabel="Billable share of approved time" />
					<span className="hero__gauge-label">Billable share</span>
				</div>
				<div className="hero__gauge">
					<RingGauge value={att && Number.isFinite(att.lateRatePercent) ? att.lateRatePercent : null} caption="late" color="var(--chart-5)" ariaLabel="Late check-in rate" />
					<span className="hero__gauge-label">Late check-ins</span>
				</div>
			</div>
		</section>
	);
}
