import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import BarChart from '../../../components/charts/BarChart';
import BarList from '../../../components/charts/BarList';
import ChartSwitch from '../../../components/charts/ChartSwitch';
import DonutChart from '../../../components/charts/DonutChart';
import GlowAreaChart from '../../../components/charts/GlowAreaChart';
import LineChart from '../../../components/charts/LineChart';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import ErrorState from '../../../components/feedback/ErrorState';
import { ROUTES } from '../../../config/routes';
import { formatDate } from '../../../utils/dates';
import { formatMinutes, formatNumber, humanize, minutesToHours } from '../../../utils/format';
import { computeInsights } from '../../../utils/insights';
import { PERIOD_PRESETS, presetLabel } from '../../../utils/periods';
import { CountUp, prefersReducedMotion, useCinematic } from '../entrance';
import { CHART_TYPES, METRICS, chartRows, hasAnyValue, metricById, typeFor } from '../billableChart';
import { insightLink } from '../insightLinks';
import useChartChoice from '../useChartChoice';
import Select from '../../../components/forms/Select';

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
	// The chart is the viewer's choice (what to show, and how); it starts as grouped bars of billable and non-billable hours, is remembered on this device and uses the trends already loaded.
	const [choice, setChoice] = useChartChoice('billable', { metric: 'split', type: 'bar' });
	const metric = metricById(choice.metric);
	const type = typeFor(metric, choice.type);
	const points = chartRows(metric, trends.data);
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
			<div className="sig-chartbar">
				<label className="sig-chip-btn sig-chip-btn--select">
					<span className="sr-only">Chart shows</span>
					<Select value={metric.id} onChange={(e) => setChoice({ metric: e.target.value })}>
						{METRICS.map((m) => (
							<option key={m.id} value={m.id}>
								{m.label}
							</option>
						))}
					</Select>
				</label>
				<ChartSwitch label="How to draw the chart" options={metric.types.map((id) => ({ id, label: CHART_TYPES[id] }))} value={type} onChange={(t) => setChoice({ type: t })} />
			</div>
			<Load res={trends} lines={4} height={190}>
				{points.length === 0 ? (
					<p className="sig-empty">No approved time in this period. Weeks without data are left blank, not shown as zero.</p>
				) : (
					<>
						{!hasAnyValue(points, metric) ? (
							<p className="sig-empty">There is no data for “{metric.label}” in this period. Gaps are left blank, not shown as zero.</p>
						) : type === 'area' ? (
							<GlowAreaChart points={points.map((p) => ({ key: p.key, label: p.label, tip: p.tip, value: p.values[metric.series[0].key] }))} height={200} format={metric.format} ariaLabel={`${metric.label} per ${per}`} />
						) : type === 'line' ? (
							<LineChart data={points.map((p) => ({ x: p.key, label: p.label, ...p.values }))} series={metric.series} height={200} yFormat={metric.format} ariaLabel={`${metric.label} per ${per}`} />
						) : (
							<BarChart points={points} series={metric.series} stacked={type === 'stacked'} height={200} format={metric.format} ariaLabel={`${metric.label} per ${per}`} />
						)}
						{metric.id === 'late' ? null : (
						<div className="sig-timeline" aria-label={`Billable share per ${per}`} role="img">
							{buckets.map((b) => (
								<span key={b.start} className="sig-timeline__seg" title={`${formatDate(b.start)}: ${Number.isFinite(b.billablePercent) ? `${formatNumber(b.billablePercent, 1)}% billable` : 'no share'}`}>
									<i style={{ width: `${Number.isFinite(b.billablePercent) ? Math.min(Math.max(b.billablePercent, 0), 100) : 0}%` }} />
								</span>
							))}
						</div>
						)}
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
						<i className="sig-legend__line" /> {metric.id === 'split' ? 'Billable / non-billable hours' : metric.label}
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

/**
 * The stacked cards. The front card is the one in focus; picking a card behind it only brings it forward
 * (click, Enter/Space, or the arrow keys on the deck). Leaving for another page is a separate, explicit
 * "Open" link on the front card, so browsing the stack never navigates by accident.
 */
function SnapshotDeck({ items, count, front, onFront }) {
	const setFront = (next) => onFront(typeof next === 'function' ? next(front) : next);
	const n = items.length;
	const onKeyDown = (e) => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		e.preventDefault();
		setFront((f) => (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (f + 1) % n : (f - 1 + n) % n));
	};
	return (
		<div className="sig-stack" role="group" aria-label="Snapshot cards" onKeyDown={onKeyDown}>
			{items.map((it, i) => {
				const pos = (i - front + n) % n; // 0 = front
				return (
					<div key={it.key} className={`sig-stack__card sig-stack__card--${it.cls}`} data-pos={pos}>
						{pos === 0 ? (
							<>
								<div className="sig-stack__brand">
									<Icon name={it.icon} size={16} />
									<span>{it.kicker}</span>
									<Link to={it.to} className="sig-stack__open" aria-label={`Open ${it.go}`}>
										Open <span aria-hidden="true">↗</span>
									</Link>
								</div>
								<span className="sig-stack__label" title={it.hint}>
									{it.label}
								</span>
								<div className="sig-stack__row">
									<b className="sig-stack__value">
										<CountUp text={it.value} enabled={count && it.key === 'employees'} />
									</b>
									{it.chip ? <Delta>{it.chip}</Delta> : null}
								</div>
							</>
						) : (
							<button type="button" className="sig-stack__pick" onClick={() => setFront(i)} aria-label={`Bring ${it.label} forward`}>
								<span>{it.label}</span>
								<b>{it.value}</b>
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}

/**
 * The list under the stack follows the card in front: workforce by status, project health, or the leave
 * overview. Same row design for all three, so switching cards feels like turning a page.
 */
function HealthList({ front, head, leave, projects, rows, can }) {
	const Row = ({ mark, title, sub, value, tone = 'up', pct, tip }) => (
		<li className="sig-row">
			<span className="sig-row__avatar" aria-hidden="true">
				{mark}
			</span>
			<span className="sig-row__text">
				<b>{title}</b>
				<small>{sub}</small>
			</span>
			<span className={`sig-row__amount sig-row__amount--${tone}`} title={tip}>
				{value}
				{Number.isFinite(pct) ? (
					<span className="sig-row__bar" aria-hidden="true">
						<i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
					</span>
				) : null}
			</span>
		</li>
	);
	let head1 = 'Project health';
	let link = can('projects.view') ? ROUTES.projects : null;
	let body;
	if (front === 0) {
		head1 = 'Workforce health';
		link = can('employees.view') ? ROUTES.employees : null;
		const by = (head && head.byStatus) || {};
		const total = head && Number.isFinite(head.total) ? head.total : 0;
		const order = ['active', 'on_leave', 'inactive'];
		const keys = [...order.filter((k) => k in by), ...Object.keys(by).filter((k) => !order.includes(k))];
		body = keys.length ? (
			<ul aria-label="Employees by status">
				{keys.map((k) => (
					<Row key={k} mark={initials(humanize(k))} title={humanize(k)} sub={`${formatNumber(by[k])} ${by[k] === 1 ? 'person' : 'people'}`} value={total ? `${formatNumber((by[k] / total) * 100, 0)}%` : '—'} pct={total ? (by[k] / total) * 100 : undefined} tone={k === 'inactive' ? 'none' : 'up'} tip="Share of everyone in scope" />
				))}
			</ul>
		) : (
			<p className="sig-empty">No employees in scope yet.</p>
		);
	} else if (front === 2) {
		head1 = 'Leave overview';
		link = can('leave.view') ? ROUTES.leave : null;
		const by = (leave && leave.byStatus) || {};
		const recs = leave && Number.isFinite(leave.records) ? leave.records : 0;
		const items = [];
		if (leave && Number.isFinite(leave.approvedDays)) items.push({ k: 'days', mark: 'D', title: 'Approved days', sub: 'Counted in days', value: `${formatNumber(leave.approvedDays, 1)} days`, tone: 'up' });
		if (leave && Number.isFinite(leave.approvedHours)) items.push({ k: 'hours', mark: 'H', title: 'Approved hours', sub: 'Hour-based leave, kept separate', value: `${formatNumber(leave.approvedHours, 1)} h`, tone: 'up' });
		Object.keys(by).forEach((k) => items.push({ k, mark: initials(humanize(k)), title: humanize(k), sub: 'Leave records', value: formatNumber(by[k]), pct: recs ? (by[k] / recs) * 100 : undefined, tone: k === 'requested' ? 'down' : 'up' }));
		body = items.length ? (
			<ul aria-label="Leave overview">
				{items.map((r) => (
					<Row key={r.k} mark={r.mark} title={r.title} sub={r.sub} value={r.value} pct={r.pct} tone={r.tone} />
				))}
			</ul>
		) : (
			<p className="sig-empty">No leave recorded for this period.</p>
		);
	} else {
		body = (
			<Load res={projects} lines={3}>
				{rows.length === 0 ? (
					<p className="sig-empty">No approved project time in this period.</p>
				) : (
					<ul aria-label="Busiest projects" tabIndex={rows.length > 4 ? 0 : undefined}>
						{rows.map((p) => {
							const burn = p.burnPercent;
							return <Row key={p.projectId} mark={initials(p.name)} title={p.name || `Project #${p.projectId}`} sub={`${p.status ? humanize(p.status) : 'No status'} · ${formatMinutes(p.periodMinutes)}`} value={burn === null ? 'No estimate' : `${formatNumber(burn, 0)}%`} pct={burn === null ? undefined : burn} tone={burn === null ? 'none' : burn > 100 ? 'down' : 'up'} tip={burn === null ? 'No estimate recorded' : 'Lifetime approved hours against the estimate'} />;
						})}
					</ul>
				)}
			</Load>
		);
	}
	return (
		<div className="sig-list" key={front}>
			<div className="sig-list__head">
				<h3>{head1}</h3>
				{link ? (
					<Link to={link} className="sig-link">
						View all
					</Link>
				) : null}
			</div>
			{body}
		</div>
	);
}

export function SidePanel({ overview, projects, onCustomize }) {
	const { can } = useAuth();
	const [front, setFront] = useState(1); // the card in front (0 workforce, 1 projects, 2 leave) picks the health list below
	const count = useCount();
	const o = overview.data;
	const head = o && o.headcount;
	const leave = o && o.leave;
	const status = projects.data && projects.data.status;
	const wl = projects.data && projects.data.workload;
	const active = head && head.byStatus ? head.byStatus.active : null;
	const rows = wl ? wl.projects : []; // the list scrolls inside the card, so every returned project is reachable
	return (
		<section className="sig-card sig-side" aria-label="Team snapshot">
			<header className="sig-head">
				<h2 className="sig-title">Team snapshot</h2>
				<button type="button" className="sig-ghost" onClick={onCustomize}>
					<Icon name="settings" size={13} /> Customize
				</button>
			</header>

			<SnapshotDeck
				items={[
					{ key: 'employees', cls: 1, kicker: 'Workforce', icon: 'users', label: 'Employees', hint: 'Everyone in scope, by employment status', value: head && Number.isFinite(head.total) ? formatNumber(head.total) : '—', chip: Number.isFinite(active) ? `${formatNumber(active)} active` : null, to: ROUTES.employees, go: 'employees' },
					{ key: 'projects', cls: 2, kicker: 'Delivery', icon: 'folder', label: 'Projects', hint: 'Projects in scope by current status', value: status && Number.isFinite(status.total) ? formatNumber(status.total) : '—', chip: status && status.byStatus && Number.isFinite(status.byStatus.active) ? `${formatNumber(status.byStatus.active)} active` : null, to: ROUTES.projects, go: 'projects' },
					{ key: 'leave', cls: 3, kicker: 'Time off', icon: 'calendar', label: 'Approved leave', hint: 'Approved leave in days; hours are never added to days', value: leave && Number.isFinite(leave.approvedDays) ? `${formatNumber(leave.approvedDays, 1)} days` : '—', chip: leave && leave.approvedHours > 0 ? `+ ${formatNumber(leave.approvedHours, 1)} h` : null, to: ROUTES.leave, go: 'leave records' },
				]}
				count={count}
				front={front}
				onFront={setFront}
			/>

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

			<HealthList front={front} head={head} leave={leave} projects={projects} rows={rows} can={can} />
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
	const [wc, setWc] = useChartChoice('workload', { type: 'columns' });
	const wtype = ['columns', 'bars', 'donut'].includes(wc.type) ? wc.type : 'columns';
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
					<ChartSwitch label="How to draw the workload" options={[{ id: 'columns', label: 'Columns' }, { id: 'bars', label: 'Bars' }, { id: 'donut', label: 'Share' }]} value={wtype} onChange={(t) => setWc({ type: t })} />
					<button type="button" className="sig-chip-btn" onClick={() => setSort((s) => (s === 'hours' ? 'name' : 'hours'))} aria-label={`Sort by ${sort === 'hours' ? 'name' : 'hours'}`}>
						Sort <span aria-hidden="true">⇅</span>
					</button>
					<label className="sig-chip-btn sig-chip-btn--select">
						<span className="sr-only">Period</span>
						<Select value={PERIOD_PRESETS.some((p) => p.id === preset && p.id !== 'custom') ? preset : ''} onChange={(e) => e.target.value && onPreset(e.target.value)}>
							{preset === 'custom' ? <option value="">Custom</option> : null}
							{PERIOD_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
								<option key={p.id} value={p.id}>
									{presetLabel(p.id)}
								</option>
							))}
						</Select>
					</label>
				</div>
			</header>
			<Load res={projects} lines={4} height={180}>
				{list.length === 0 ? (
					<p className="sig-empty">No approved project time in this period.</p>
				) : (
					wtype === 'bars' ? (
						<BarList ariaLabel="Approved hours by project" items={shown.map((p) => ({ id: String(p.projectId), label: p.name || `Project #${p.projectId}`, value: p.h, display: `${hoursText(p.h)}h` }))} />
					) : wtype === 'donut' ? (
						<DonutChart ariaLabel="Share of approved hours by project" centerLabel="hours" segments={shown.map((p) => ({ label: p.name || `Project #${p.projectId}`, value: Math.round(p.h * 10) / 10 }))} />
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
					)
				)}
			</Load>
		</section>
	);
}
