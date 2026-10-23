import React, { useId, useMemo, useState } from 'react';
import useChartSize from '../../hooks/useChartSize';
import { niceMax } from './scale';

const M = { top: 8, right: 12, bottom: 24, left: 40 };

/**
 * Multi-series line chart (SVG). Categorical x axis, `null` y values leave a gap (no data is
 * never drawn as zero). Pointer hover and arrow keys move a crosshair with a tooltip; a hidden
 * table mirrors the data for screen readers.
 *
 * data:   [{ x: '2026-10-05', label: '05 Oct', <seriesKey>: number|null, ... }]
 * series: [{ key, label, color }]
 */
export default function LineChart({ data, series, height = 200, yFormat = (v) => String(v), ariaLabel, area = false }) {
	const [ref, width] = useChartSize();
	const [active, setActive] = useState(null);
	const id = useId();
	const innerW = Math.max(width - M.left - M.right, 10);
	const innerH = height - M.top - M.bottom;

	const max = useMemo(() => niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => (Number.isFinite(d[s.key]) ? d[s.key] : 0))))), [data, series]);
	const x = (i) => M.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
	const y = (v) => M.top + innerH - (v / max) * innerH;
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
	const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))));

	const paths = series.map((s) => {
		const segments = [];
		let cur = [];
		data.forEach((d, i) => {
			if (Number.isFinite(d[s.key])) cur.push([x(i), y(d[s.key])]);
			else if (cur.length) {
				segments.push(cur);
				cur = [];
			}
		});
		if (cur.length) segments.push(cur);
		return segments;
	});

	const nearest = (clientX, rect) => {
		const px = clientX - rect.left;
		const i = Math.round(((px - M.left) / innerW) * (data.length - 1));
		return Math.min(Math.max(i, 0), data.length - 1);
	};
	const onKey = (e) => {
		if (!data.length) return;
		if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : Math.min(a + 1, data.length - 1)));
		else if (e.key === 'ArrowLeft') setActive((a) => (a === null ? data.length - 1 : Math.max(a - 1, 0)));
		else if (e.key === 'Escape') setActive(null);
		else return;
		e.preventDefault();
	};

	const tip = active !== null ? data[active] : null;
	return (
		<div className="chart" ref={ref}>
			<svg width={width} height={height} role="group" aria-label={ariaLabel}>
				<g className="chart__grid chart__axis">
					{ticks.map((t) => (
						<g key={t}>
							<line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
							<text x={M.left - 6} y={y(t) + 3.5} textAnchor="end">
								{yFormat(t)}
							</text>
						</g>
					))}
				</g>
				<g className="chart__axis">
					{data.map((d, i) =>
						i % labelEvery === 0 ? (
							<text key={d.x} x={x(i)} y={height - 6} textAnchor="middle">
								{d.label || d.x}
							</text>
						) : null
					)}
				</g>
				{series.map((s, si) =>
					paths[si].map((seg, k) => {
						const d = seg.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
						return (
							<g key={`${s.key}-${k}`}>
								{area && seg.length > 1 ? <path className="chart__area" d={`${d} L${seg[seg.length - 1][0]} ${M.top + innerH} L${seg[0][0]} ${M.top + innerH} Z`} fill={s.color} /> : null}
								<path className="chart__line" d={d} stroke={s.color} style={{ '--len': 4000 }} />
								{seg.length === 1 ? <circle cx={seg[0][0]} cy={seg[0][1]} r="3.5" fill={s.color} /> : null}
							</g>
						);
					})
				)}
				{tip ? (
					<g>
						<line className="chart__cursor" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} />
						{series.map((s) => (Number.isFinite(tip[s.key]) ? <circle key={s.key} className="chart__dot" cx={x(active)} cy={y(tip[s.key])} r="4" fill={s.color} /> : null))}
					</g>
				) : null}
				<rect
					className="chart__plot"
					x={M.left}
					y={M.top}
					width={innerW}
					height={innerH}
					fill="transparent"
					tabIndex={0}
					role="img"
					aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
					aria-describedby={`${id}-table`}
					onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
					onPointerLeave={() => setActive(null)}
					onFocus={() => setActive((a) => (a === null ? data.length - 1 : a))}
					onBlur={() => setActive(null)}
					onKeyDown={onKey}
				/>
			</svg>
			{tip ? (
				<div className="chart-tip" style={{ left: Math.min(Math.max(x(active), 70), width - 70), top: M.top + 4 }} role="status">
					<strong>{tip.label || tip.x}</strong>
					{series.map((s) => (
						<div key={s.key}>
							<span>
								<i className="chart-swatch" style={{ background: s.color }} />
								{s.label}
							</span>
							<b>{Number.isFinite(tip[s.key]) ? yFormat(tip[s.key]) : 'No data'}</b>
						</div>
					))}
				</div>
			) : null}
			<div className="legend">
				{series.map((s) => (
					<span key={s.key}>
						<i style={{ background: s.color }} />
						{s.label}
					</span>
				))}
			</div>
			<table id={`${id}-table`} className="sr-only">
				<caption>{ariaLabel}</caption>
				<thead>
					<tr>
						<th>Period</th>
						{series.map((s) => (
							<th key={s.key}>{s.label}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.map((d) => (
						<tr key={d.x}>
							<td>{d.label || d.x}</td>
							{series.map((s) => (
								<td key={s.key}>{Number.isFinite(d[s.key]) ? yFormat(d[s.key]) : 'No data'}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
