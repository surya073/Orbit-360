import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import GlowAreaChart from '../../../components/charts/GlowAreaChart';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import ErrorState from '../../../components/feedback/ErrorState';
import { ROUTES } from '../../../config/routes';
import { formatDate } from '../../../utils/dates';
import { formatMinutes, formatNumber, humanize, minutesToHours } from '../../../utils/format';
import { computeInsights } from '../../../utils/insights';
import { PERIOD_PRESETS, presetLabel } from '../../../utils/periods';
import { CountUp, prefersReducedMotion, useCinematic } from '../entrance';
import { insightLink } from '../insightLinks';
import logo from '../../../assets/images/logo.svg';

/*
 * The dashboard's signature section, laid out like the reference design (data/dashboardreference.png):
 *   [ Billable hours chart (wide)      ][ Team snapshot: stacked cards, actions,  ]
 *   [ Needs attention ][ Workload bars ][ project health list                    ]
 * Every figure is a backend metric already loaded for the dashboard (no extra requests); a missing
 * value is a dash with its reason, never a zero.
 */

const useCount = () => {
	const cinematic = useCinematic();
	return cinematic && process.env.NODE_ENV !== 'test' && !prefersReducedMotion();
};
const hours = (min) => minutesToHours(min);
const hoursText = (h) => (Number.isFinite(h) ? formatNumber(h, h < 10 ? 1 : 0) : '—');

function Skeleton({ lines = 3, height }) {
	return (
		<div className="sig-skel" aria-hidden="true" style={height ? { height } : undefined}>
			{Array.from({ length: lines }, (_, i) => (
				<span key={i} style={{ width: `${88 - i * 14}%` }} />
			))}
		</div>
	);
}

/** Loading / error wrapper with the card's own retry; renders children once data is there. */
function Load({ res, children, lines, height }) {
	if (res.status === 'error') return <ErrorState error={res.error} onRetry={res.reload} compact />;
	if (!res.data) return <Skeleton lines={lines} height={height} />;
	return children;
}

const Delta = ({ tone = 'up', children }) => (
	<span className={`sig-delta sig-delta--${tone}`}>
		{tone === 'up' ? <span aria-hidden="true">↑</span> : null}
		{children}
	</span>
);

// ---- Billable hours (the "Total Balance" card) ------------------------------------------------------

const PILLS = ['this_quarter', 'last_month', 'last_30_days', 'this_month'];
const PILL_LABEL = { this_quarter: 'Quarter', last_month: 'Last month', last_30_days: '30 days', this_month: 'This month' };

export function BillableCard({ overview, trends, clamped, preset, onPreset }) {
	const count = useCount();
	const time = overview.data && overview.data.time;
	const billable = time ? hours(time.billableMinutes) : null;
	const buckets = (trends.data && trends.data.time) || [];
	const per = trends.data ? trends.data.filters.granularity : 'week';
	const points = buckets.map((b) => ({
		key: b.start,
		label: formatDate(b.start).slice(0, 6),
		tip: per === 'day' ? formatDate(b.start) : `Week of ${formatDate(b.start).slice(0, 6)}`,
		value: hours(b.billableMinutes),
	}));
	return (
		<section className="sig-card sig-balance" aria-label="Billable hours trend">
			<header className="sig-head">
				<div>
					<h2 className="sig-title">Billable hours</h2>
					<p className="sig-value">
						{billable === null ? (
							<span className="sig-value__empty">—</span>
						) : (
							<>
								<CountUp text={hoursText(billable)} enabled={count} />
								<small>h</small>
							</>
						)}
						{time && Number.isFinite(time.billablePercent) ? <Delta>{formatNumber(time.billablePercent, 1)}% billable</Delta> : null}
						{time ? <CompletenessBadge metric={time} /> : null}
					</p>
				</div>
				<div className="sig-pills" role="group" aria-label="Period">
					{PILLS.map((id) => (
						<button key={id} type="button" className={`sig-pill ${preset === id ? 'is-on' : ''}`.trim()} aria-pressed={preset === id} onClick={() => onPreset(id)}>
							{PILL_LABEL[id]}
						</button>
					))}
				</div>
			</header>
			<Load res={trends} lines={4} height={190}>
				{points.length === 0 ? (
					<p className="sig-empty">No approved time in this period. Weeks without data are left blank, not shown as zero.</p>
				) : (
					<>
						<GlowAreaChart points={points} height={200} format={(v) => `${formatNumber(v, v < 10 ? 1 : 0)}h`} ariaLabel={`Billable hours per ${per}`} />
						<div className="sig-timeline" aria-label={`Billable share per ${per}`} role="img">
							{buckets.map((b) => (
								<span key={b.start} className="sig-timeline__seg" title={`${formatDate(b.start)}: ${Number.isFinite(b.billablePercent) ? `${formatNumber(b.billablePercent, 1)}% billable` : 'no share'}`}>
									<i style={{ width: `${Number.isFinite(b.billablePercent) ? Math.min(Math.max(b.billablePercent, 0), 100) : 0}%` }} />
								</span>
							))}
						</div>
					</>
				)}
			</Load>
			<footer className="sig-foot">
				<span className="muted">
					Approved entries <b className="sig-foot__num">{time && Number.isFinite(time.approvedEntries) ? formatNumber(time.approvedEntries) : '—'}</b>
					{clamped ? ' · last 90 days of the period' : ''}
				</span>
				<span className="sig-legend">
					<span>
						<i className="sig-legend__line" /> Billable hours
					</span>
					<span>
						<i className="sig-legend__share" /> Billable share
					</span>
				</span>
			</footer>
		</section>
	);
}

// ---- Team snapshot + project health (the "My cards" + "Recent transactions" column) ----------------

const initials = (name) =>
	String(name || '?')
		.split(/[\s-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('');

export function SidePanel({ overview, projects, onCustomize }) {
	const { can } = useAuth();
	const count = useCount();
	const o = overview.data;
	const head = o && o.headcount;
	const leave = o && o.leave;
	const status = projects.data && projects.data.status;
	const wl = projects.data && projects.data.workload;
	const active = head && head.byStatus ? head.byStatus.active : null;
	const rows = wl ? wl.projects.slice(0, 3) : [];
	return (
		<section className="sig-card sig-side" aria-label="Team snapshot">
			<header className="sig-head">
				<h2 className="sig-title">Team snapshot</h2>
				<button type="button" className="sig-ghost" onClick={onCustomize}>
					<Icon name="settings" size={13} /> Customize
				</button>
			</header>

			<div className="sig-stack">
				<div className="sig-stack__card sig-stack__card--3">
					<span>Approved leave</span>
					<b>{leave && Number.isFinite(leave.approvedDays) ? `${formatNumber(leave.approvedDays, 1)} days` : '—'}</b>
				</div>
				<div className="sig-stack__card sig-stack__card--2">
					<span className="sig-stack__dots" aria-hidden="true">
						<i />
						<i />
					</span>
					<b>{status && Number.isFinite(status.total) ? `${formatNumber(status.total)} projects` : '—'}</b>
				</div>
				<div className="sig-stack__card sig-stack__card--1">
					<div className="sig-stack__brand">
						<img src={logo} alt="" width="18" height="18" />
						<span>COMPANY 360</span>
					</div>
					<span className="sig-stack__chip" aria-hidden="true" />
					<span className="sig-stack__label">Employees</span>
					<div className="sig-stack__row">
						<b className="sig-stack__value">{head && Number.isFinite(head.total) ? <CountUp text={formatNumber(head.total)} enabled={count} /> : '—'}</b>
						{Number.isFinite(active) ? <Delta>{formatNumber(active)} active</Delta> : null}
					</div>
				</div>
			</div>

			{can('spreadsheet.view') || can('presentations.view') ? (
				<div className="sig-actions">
					{can('spreadsheet.view') ? (
						<Button className="sig-btn sig-btn--muted" to={ROUTES.spreadsheet}>
							<span aria-hidden="true">↘</span> Spreadsheet
						</Button>
					) : null}
					{can('presentations.view') ? (
						<Button className="sig-btn sig-btn--hot" to={ROUTES.presentations}>
							<span aria-hidden="true">↗</span> Presentations
						</Button>
					) : null}
				</div>
			) : null}

			<div className="sig-list">
				<div className="sig-list__head">
					<h3>Project health</h3>
					{can('projects.view') ? (
						<Link to={ROUTES.projects} className="sig-link">
							View all
						</Link>
					) : null}
				</div>
				<Load res={projects} lines={3}>
					{rows.length === 0 ? (
						<p className="sig-empty">No approved project time in this period.</p>
					) : (
						<ul aria-label="Busiest projects">
							{rows.map((p) => {
								const burn = p.burnPercent;
								const tone = burn === null ? 'none' : burn > 100 ? 'down' : 'up';
								return (
									<li key={p.projectId} className="sig-row">
										<span className="sig-row__avatar" aria-hidden="true">
											{initials(p.name)}
										</span>
										<span className="sig-row__text">
											<b>{p.name || `Project #${p.projectId}`}</b>
											<small>
												{p.status ? humanize(p.status) : 'No status'} · {formatMinutes(p.periodMinutes)}
											</small>
										</span>
										<span className={`sig-row__amount sig-row__amount--${tone}`} title={burn === null ? 'No estimate recorded' : 'Lifetime approved hours against the estimate'}>
											{burn === null ? 'No estimate' : `${formatNumber(burn, 0)}%`}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</Load>
			</div>
		</section>
	);
}

// ---- Needs attention (the orange promo card) --------------------------------------------------------

export function AttentionCard({ overview, projects, product, freshness }) {
	const { can } = useAuth();
	const flags = useMemo(() => computeInsights({ overview: overview.data, projects: projects.data, product: product.data, freshness: freshness.data }).filter((i) => i.tone === 'warning'), [overview.data, projects.data, product.data, freshness.data]);
	const settled = [overview, projects, product, freshness].every((r) => r.status !== 'loading' || r.data);
	const first = flags[0];
	const to = first ? insightLink(first.id) : null;
	const n = flags.length;
	return (
		<section className="sig-card sig-promo" aria-label="Needs attention">
			<span className="sig-promo__orb sig-promo__orb--a" aria-hidden="true" />
			<span className="sig-promo__orb sig-promo__orb--b" aria-hidden="true" />
			<span className="sig-promo__orb sig-promo__orb--c" aria-hidden="true" />
			<div className="sig-promo__body">
				<h2 className="sig-promo__title">
					{!settled ? (
						'Checking your data…'
					) : n ? (
						<>
							{n} {n === 1 ? 'item' : 'items'} <em>need attention</em>
							<br />
							Review today
						</>
					) : (
						<>
							All clear <em>for now</em>
							<br />
							Nothing flagged
						</>
					)}
				</h2>
				<p className="sig-promo__text">{first ? first.title : settled ? 'Nothing is flagged for this selection.' : ' '}</p>
				{n ? (
					<ul className="sig-promo__bubbles" aria-label="Flagged items">
						{flags.slice(0, 3).map((f) => (
							<li key={f.id} title={f.title}>
								<Icon name="alert" size={14} />
							</li>
						))}
						{n > 3 ? <li className="is-more">+{n - 3}</li> : <li className="is-more" aria-hidden="true">+</li>}
					</ul>
				) : null}
			</div>
			{to ? (
				<Link className="sig-promo__btn" to={to}>
					Review now
				</Link>
			) : can('presentations.view') ? (
				<Link className="sig-promo__btn" to={ROUTES.presentations}>
					Open presentations
				</Link>
			) : null}
		</section>
	);
}

// ---- Workload (the "Investments" bar chart) ---------------------------------------------------------

export function WorkloadCard({ projects, preset, onPreset }) {
	const count = useCount();
	const [sort, setSort] = useState('hours');
	const wl = projects.data && projects.data.workload;
	const list = wl ? wl.projects.slice(0, 6).map((p) => ({ ...p, h: hours(p.periodMinutes) || 0 })) : [];
	const shown = sort === 'name' ? [...list].sort((a, b) => String(a.name).localeCompare(String(b.name))) : list;
	const max = Math.max(1, ...list.map((p) => p.h));
	const topId = list.length ? list.reduce((a, b) => (b.h > a.h ? b : a)).projectId : null;
	const total = list.reduce((s, p) => s + p.h, 0);
	return (
		<section className="sig-card sig-bars" aria-label="Workload">
			<header className="sig-head">
				<div>
					<h2 className="sig-title">Workload</h2>
					<p className="sig-value sig-value--sm">
						{wl && list.length ? (
							<>
								<CountUp text={hoursText(total)} enabled={count} />
								<small>h</small>
							</>
						) : (
							<span className="sig-value__empty">—</span>
						)}
						{wl && wl.projectsWithTime ? <Delta>{formatNumber(wl.projectsWithTime)} projects</Delta> : null}
					</p>
				</div>
				<div className="sig-tools">
					<button type="button" className="sig-chip-btn" onClick={() => setSort((s) => (s === 'hours' ? 'name' : 'hours'))} aria-label={`Sort by ${sort === 'hours' ? 'name' : 'hours'}`}>
						Sort <span aria-hidden="true">⇅</span>
					</button>
					<label className="sig-chip-btn sig-chip-btn--select">
						<span className="sr-only">Period</span>
						<select value={PERIOD_PRESETS.some((p) => p.id === preset && p.id !== 'custom') ? preset : ''} onChange={(e) => e.target.value && onPreset(e.target.value)}>
							{preset === 'custom' ? <option value="">Custom</option> : null}
							{PERIOD_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
								<option key={p.id} value={p.id}>
									{presetLabel(p.id)}
								</option>
							))}
						</select>
					</label>
				</div>
			</header>
			<Load res={projects} lines={4} height={180}>
				{list.length === 0 ? (
					<p className="sig-empty">No approved project time in this period.</p>
				) : (
					<div className="sig-columns" role="img" aria-label={`Approved hours by project: ${shown.map((p) => `${p.name || `Project #${p.projectId}`} ${hoursText(p.h)} hours`).join(', ')}`}>
						{shown.map((p, i) => {
							const top = p.projectId === topId;
							return (
								<div key={p.projectId} className={`sig-col ${top ? 'is-top' : ''}`.trim()} style={{ '--h': `${Math.max((p.h / max) * 100, 4)}%`, '--n': i }}>
									<span className={top ? 'sig-col__chip' : 'sig-col__val'}>{hoursText(p.h)}h</span>
									<span className="sig-col__bar" />
									<span className="sig-col__name" title={p.name || `Project #${p.projectId}`}>
										{p.name || `#${p.projectId}`}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</Load>
		</section>
	);
}
