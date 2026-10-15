import React, { useId, useMemo, useState } from 'react';
import useChartSize from '../../hooks/useChartSize';
import { niceMax } from './scale';

const M = { top: 46, right: 52, bottom: 26, left: 6 };

/** Smooth path through points (Catmull-Rom as cubic Béziers); breaks at missing values so gaps stay gaps. */
function smooth(pts) {
	if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : '';
	let d = `M${pts[0][0]} ${pts[0][1]}`;
	for (let i = 0; i < pts.length - 1; i += 1) {
		const p0 = pts[i - 1] || pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] || p2;
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
	}
	return d;
}

/**
 * The dashboard's signature chart: one warm area with a glowing line, a light tooltip resting on the
 * peak (or on the point you hover / move to with the arrow keys), value labels on the right and dates
 * underneath. `points`: [{ key, label, tip, value }] where a missing value is null (shown as a gap,
 * never as zero). A screen-reader table carries the same numbers.
 */
export default function GlowAreaChart({ points, height = 200, format = (v) => String(v), ariaLabel, tipTitle = (p) => p.tip || p.label }) {
	const id = useId();
	const [ref, width] = useChartSize(640);
	const values = points.map((p) => p.value).filter((v) => Number.isFinite(v));
	// Four even ticks that hug the data (66 -> 75, not 100), so the area fills the card like the reference.
	const top = values.length ? Math.max(...values) : 1;
	const step = niceMax(top / 4);
	const max = top > 0 ? Math.ceil(top / step) * step : 1;
	const innerW = Math.max(width - M.left - M.right, 10);
	const innerH = Math.max(height - M.top - M.bottom, 10);
	const x = (i) => M.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
	const y = (v) => M.top + innerH - (v / max) * innerH;
	const peak = useMemo(() => points.reduce((best, p, i) => (Number.isFinite(p.value) && (best < 0 || p.value > points[best].value) ? i : best), -1), [points]);
	const [hover, setHover] = useState(null);
	const active = hover !== null && Number.isFinite((points[hover] || {}).value) ? hover : peak;

	// Continuous runs of real values (a missing bucket splits the line).
	const runs = [];
	let run = [];
	points.forEach((p, i) => {
		if (Number.isFinite(p.value)) run.push([x(i), y(p.value)]);
		else if (run.length) {
			runs.push(run);
			run = [];
		}
	});
	if (run.length) runs.push(run);

	const ticks = [1, 0.75, 0.5, 0.25].map((f) => f * max);
	const labelEvery = Math.max(1, Math.ceil(points.length / 6));
	const pick = (clientX, rect) => {
		const rel = clientX - rect.left - M.left;
		const i = Math.round((rel / innerW) * (points.length - 1));
		return Math.min(Math.max(i, 0), points.length - 1);
	};
	const move = (dir) => {
		let i = active < 0 ? 0 : active;
		do i += dir;
		while (i >= 0 && i < points.length && !Number.isFinite(points[i].value));
		if (i >= 0 && i < points.length) setHover(i);
	};
	const tip = active >= 0 ? points[active] : null;
	const tipX = tip ? Math.min(Math.max(x(active), 76), width - M.right - 70) : 0; // never over the value labels

	return (
		<div className="glow-chart" ref={ref}>
			<svg width={width} height={height} role="img" aria-label={ariaLabel} aria-describedby={`${id}-table`} focusable="false">
				<defs>
					<linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.55" />
						<stop offset="70%" stopColor="var(--chart-1)" stopOpacity="0.12" />
						<stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
					</linearGradient>
					<filter id={`${id}-glow`} x="-20%" y="-50%" width="140%" height="200%">
						<feGaussianBlur stdDeviation="4" result="b" />
						<feMerge>
							<feMergeNode in="b" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				<g className="glow-chart__grid" aria-hidden="true">
					{points.map((p, i) => (i % labelEvery === 0 ? <line key={p.key} x1={x(i)} x2={x(i)} y1={M.top - 8} y2={M.top + innerH} /> : null))}
				</g>
				<g className="glow-chart__axis" aria-hidden="true">
					{ticks.map((t) => (
						<text key={t} x={width - 4} y={y(t) + 4} textAnchor="end">
							{format(t)}
						</text>
					))}
					{points.map((p, i) =>
						i % labelEvery === 0 ? (
							<text key={p.key} x={x(i)} y={height - 6} textAnchor="middle">
								{p.label}
							</text>
						) : null
					)}
				</g>
				{runs.map((r, k) => {
					const line = smooth(r);
					const area = `${line} L${r[r.length - 1][0]} ${M.top + innerH} L${r[0][0]} ${M.top + innerH} Z`;
					return (
						<g key={k}>
							<path className="glow-chart__area" d={area} fill={`url(#${id}-fill)`} />
							<path className="glow-chart__line" d={line} filter={`url(#${id}-glow)`} pathLength="1" />
						</g>
					);
				})}
				{tip ? (
					<g className="glow-chart__mark" aria-hidden="true">
						<line x1={x(active)} x2={x(active)} y1={y(tip.value)} y2={M.top + innerH} />
						<circle className="glow-chart__halo" cx={x(active)} cy={y(tip.value)} r="11" />
						<circle className="glow-chart__dot" cx={x(active)} cy={y(tip.value)} r="5" />
					</g>
				) : null}
				<rect
					className="glow-chart__plot"
					x={M.left}
					y={M.top - 10}
					width={innerW}
					height={innerH + 10}
					tabIndex={0}
					aria-label={`${ariaLabel}. Use the left and right arrow keys to read each point.`}
					onMouseMove={(e) => setHover(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
					onMouseLeave={() => setHover(null)}
					onKeyDown={(e) => {
						if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
							e.preventDefault();
							move(e.key === 'ArrowRight' ? 1 : -1);
						}
					}}
				/>
			</svg>
			{tip ? (
				<div className="glow-chart__tip" style={{ left: tipX, top: Math.max(y(tip.value) - 64, 0) }} role="status" aria-live="polite">
					<span>{tipTitle(tip)}</span>
					<b>{format(tip.value)}</b>
				</div>
			) : null}
			<table id={`${id}-table`} className="sr-only">
				<caption>{ariaLabel}</caption>
				<tbody>
					{points.map((p) => (
						<tr key={p.key}>
							<th scope="row">{p.tip || p.label}</th>
							<td>{Number.isFinite(p.value) ? format(p.value) : 'No data'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
