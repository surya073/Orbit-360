import React, { useMemo, useState } from 'react';
import { formatNumber } from '../../../utils/format';
import { CountUp } from '../../dashboard/entrance';
import { colorCss, metricLabel } from './slideModel';
import { widgetModel } from './widgetData';

/**
 * Live-data widgets for studio slides. They are drawn for presenting, not copied from the dashboard: one big number with
 * the change on the previous period, ranked bars and leaderboards that grow in, a donut whose centre follows the pointer,
 * and a trend line with a crosshair. Hover reveals the detail behind a figure. Every figure is a backend metric; a
 * missing one is a dash with its reason.
 *
 * Colours come from the object: `st.color` (text), `st.fill` (card), `st.fill2` (accent for bars and lines).
 */

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
const fmt = (v, d = 1) => (v === null || v === undefined ? '—' : formatNumber(v, Number.isInteger(v) ? 0 : d));

function Shell({ o, label, children, empty }) {
	const s = o.st || {};
	return (
		<div className="sw" style={{ color: colorCss(s.color, 'var(--text)'), background: colorCss(s.fill, 'transparent'), borderRadius: `${s.r ?? 28}px` }}>
			<div className="sw__label">{label}</div>
			{empty ? <div className="sw__empty">{empty}</div> : children}
		</div>
	);
}

function Delta({ delta, unit }) {
	if (!delta) return null;
	const arrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '■';
	const tone = delta.good === null ? 'flat' : delta.good ? 'good' : 'bad';
	return (
		<span className={`sw__delta sw__delta--${tone}`} title="Compared with the period just before this one">
			{arrow} {fmt(Math.abs(delta.pct))}% <small>vs previous period{unit ? '' : ''}</small>
		</span>
	);
}

function Kpi({ o, m, label }) {
	const value = m.value === null || m.value === undefined ? null : `${fmt(m.value)}${m.unit === '%' ? '%' : ''}`;
	return (
		<Shell o={o} label={label}>
			<div className="sw__big">
				{value === null ? <span className="sw__dash">—</span> : <CountUp text={value} />}
				{m.unit && m.unit !== '%' ? <small>{m.unit}</small> : null}
			</div>
			<Delta delta={m.delta} />
			{m.value === null ? <p className="sw__note">No figure for this selection</p> : m.note ? <p className="sw__note">{m.note}</p> : m.comparing && !m.delta ? <p className="sw__note">No earlier figure to compare with</p> : null}
		</Shell>
	);
}

function Bars({ o, m, label, accent }) {
	const max = Math.max(...m.items.map((i) => i.value), 1);
	return (
		<Shell o={o} label={label} empty={m.items.length ? null : 'No approved time in this period'}>
			<ol className="sw__bars">
				{m.items.map((it, i) => (
					<li key={it.label} className="sw__bar" style={{ '--i': i }} tabIndex={0}>
						<span className="sw__bar-name">{it.label}</span>
						<span className="sw__bar-track">
							<i style={{ width: `${(it.value / max) * 100}%`, background: accent || PALETTE[i % PALETTE.length] }} />
						</span>
						<b>
							{fmt(it.value)} {m.unit}
						</b>
						<span className="sw__tip">{it.sub}</span>
					</li>
				))}
			</ol>
		</Shell>
	);
}

function Leaders({ o, m, label, accent }) {
	const max = Math.max(...m.items.map((i) => i.value), 1);
	const initials = (n) => n.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
	return (
		<Shell o={o} label={label} empty={m.items.length ? null : 'Nobody to show for this period'}>
			<ol className="sw__leaders">
				{m.items.map((it, i) => (
					<li key={it.label} className="sw__leader" style={{ '--i': i }} tabIndex={0}>
						<span className="sw__rank">{i + 1}</span>
						<span className="sw__avatar" style={{ background: accent || PALETTE[i % PALETTE.length] }}>
							{initials(it.label)}
						</span>
						<span className="sw__who">
							<b>{it.label}</b>
							{it.sub ? <small>{it.sub}</small> : null}
							<span className="sw__bar-track">
								<i style={{ width: `${(it.value / max) * 100}%`, background: accent || PALETTE[i % PALETTE.length] }} />
							</span>
						</span>
						<b className="sw__val">
							{fmt(it.value)} {m.unit}
						</b>
					</li>
				))}
			</ol>
		</Shell>
	);
}

function Donut({ o, m, label, accent }) {
	const [hot, setHot] = useState(-1);
	const R = 90;
	const C = 2 * Math.PI * R;
	const segs = useMemo(() => {
		let at = 0;
		return m.items.map((it, i) => {
			const len = (it.pct / 100) * C;
			// with an accent colour the segments are shades of it; without one they use the chart colours
			const seg = { ...it, len, at, color: accent || PALETTE[i % PALETTE.length], fade: accent ? Math.max(0.25, 1 - i * 0.28) : 1 };
			at += len;
			return seg;
		});
	}, [m.items, C, accent]);
	const cur = hot >= 0 ? m.items[hot] : null;
	return (
		<Shell o={o} label={label} empty={m.items.length && m.items.some((i) => i.value > 0) ? null : 'Nothing to show for this selection'}>
			<div className={`sw__donut ${o.w < 720 ? 'sw__donut--stack' : ''}`.trim()}>
				<div className="sw__ring">
				<svg viewBox="0 0 240 240" role="img" aria-label={label}>
					<g transform="rotate(-90 120 120)">
						<circle cx="120" cy="120" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="30" />
						{segs.map((s, i) => (
							<circle key={s.label} className={`sw__seg ${hot === i ? 'is-hot' : ''}`} cx="120" cy="120" r={R} fill="none" stroke={s.color} strokeWidth={hot === i ? 38 : 30} strokeDasharray={`${Math.max(s.len - 2, 0)} ${C}`} strokeDashoffset={-s.at} strokeOpacity={s.fade} style={{ '--i': i }} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(-1)} />
						))}
					</g>
				</svg>
				<div className="sw__donut-mid">
					<b>{cur ? fmt(cur.value) : fmt(m.total)}</b>
					<small>{cur ? `${cur.label} · ${cur.pct}%` : m.totalLabel}</small>
				</div>
				</div>
				<ul className="sw__legend">
					{segs.map((s, i) => (
						<li key={s.label} className={hot === i ? 'is-hot' : ''} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(-1)}>
							<i style={{ background: s.color, opacity: s.fade }} />
							<span>{s.label}</span>
							<b>
								{fmt(s.value)}
								{m.unit ? ` ${m.unit}` : ''}
							</b>
						</li>
					))}
				</ul>
			</div>
		</Shell>
	);
}

function Trend({ o, m, label, accent }) {
	const [at, setAt] = useState(-1);
	const pts = m.series;
	const W = 600;
	const H = 220;
	const pad = 18;
	const max = Math.max(...pts.map((p) => p.value), 1);
	const x = (i) => pad + (pts.length > 1 ? (i / (pts.length - 1)) * (W - pad * 2) : (W - pad * 2) / 2);
	const y = (v) => H - pad - (v / max) * (H - pad * 2);
	const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
	const area = pts.length ? `${line} L${x(pts.length - 1).toFixed(1)} ${H - pad} L${x(0).toFixed(1)} ${H - pad} Z` : '';
	const stroke = accent || 'var(--accent)';
	const onMove = (e) => {
		const svg = e.currentTarget;
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		let best = 0;
		pts.forEach((_, i) => {
			if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
		});
		setAt(best);
	};
	const cur = at >= 0 ? pts[at] : pts[pts.length - 1];
	return (
		<Shell o={o} label={label} empty={pts.length ? null : 'No data over this period'}>
			<div className="sw__trend-head">
				<b>
					{cur ? fmt(cur.value) : '—'} {m.unit}
				</b>
				<small>{cur ? cur.label : ''}</small>
			</div>
			<svg className="sw__trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setAt(-1)}>
				<defs>
					<linearGradient id={`sw-g-${o.id}`} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stopColor={stroke} stopOpacity="0.38" />
						<stop offset="1" stopColor={stroke} stopOpacity="0" />
					</linearGradient>
				</defs>
				<path className="sw__area" d={area} fill={`url(#sw-g-${o.id})`} />
				<path className="sw__line" d={line} fill="none" stroke={stroke} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" pathLength="1" />
				{at >= 0 ? (
					<g>
						<line x1={x(at)} x2={x(at)} y1={pad} y2={H - pad} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 6" />
						<circle cx={x(at)} cy={y(pts[at].value)} r="8" fill={stroke} stroke="var(--bg)" strokeWidth="3" />
					</g>
				) : null}
			</svg>
		</Shell>
	);
}

/** The widget on a slide. `data` is the dashboard data hook's result; `prev` the previous period's overview. */
export default function WidgetView({ o, data, prev }) {
	const w = useMemo(() => o.widget || { type: 'kpi', metric: 'billable_hours' }, [o.widget]);
	const label = metricLabel(w.metric);
	const m = useMemo(() => widgetModel(w, data || {}, prev), [w, data, prev]);
	const accent = o.st && o.st.fill2 ? colorCss(o.st.fill2) : null;
	if (m.status === 'loading') return <Shell o={o} label={label} empty="Loading…" />;
	if (m.status === 'error') return <Shell o={o} label={label} empty="This figure could not be loaded" />;
	if (m.kind === 'kpi') return <Kpi o={o} m={m} label={label} />;
	if (m.kind === 'bars') return <Bars o={o} m={m} label={label} accent={accent} />;
	if (m.kind === 'leaders') return <Leaders o={o} m={m} label={label} accent={accent} />;
	if (m.kind === 'donut') return <Donut o={o} m={m} label={label} accent={accent} />;
	if (m.kind === 'trend') return <Trend o={o} m={m} label={label} accent={accent} />;
	return <Shell o={o} label={label} empty="Unknown widget" />;
}
