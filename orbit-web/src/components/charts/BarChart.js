import React, { useId, useState } from 'react';
import useChartSize from '../../hooks/useChartSize';
import { colorAt, niceMax } from './scale';

const M = { top: 22, right: 10, bottom: 26, left: 40 };

/**
 * Vertical bar chart (SVG): one bar per point, or several series side by side (`grouped`) or piled up (`stacked`).
 * A missing value (null) draws no bar, never a zero-height one. Hovering or focusing a column shows its values; a
 * hidden table carries the same numbers for screen readers.
 *
 * points: [{ key, label, tip?, values: { <seriesKey>: number|null } }]
 * series: [{ key, label, color? }]
 */
export default function BarChart({ points, series, stacked = false, height = 220, format = (v) => String(v), ariaLabel }) {
	const id = useId();
	const [ref, width] = useChartSize(640);
	const [active, setActive] = useState(null);
	const num = (v) => (Number.isFinite(v) ? v : null);
	const colorOf = (s, i) => s.color || colorAt(i);
	const totalOf = (p) => series.reduce((sum, s) => sum + (num(p.values[s.key]) || 0), 0);
	const top = Math.max(0, ...points.map((p) => (stacked ? totalOf(p) : Math.max(0, ...series.map((s) => num(p.values[s.key]) || 0)))));
	const max = niceMax(top);
	const innerW = Math.max(width - M.left - M.right, 10);
	const innerH = Math.max(height - M.top - M.bottom, 10);
	const slot = innerW / Math.max(points.length, 1);
	const groupW = Math.min(slot * 0.68, 64 * (stacked ? 1 : series.length));
	const barW = stacked ? groupW : groupW / series.length;
	const y = (v) => M.top + innerH - (v / max) * innerH;
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
	const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 56))));
	const showValues = points.length <= 12 && barW >= 18;

	return (
		<div ref={ref} className="barchart">
			<svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel} onMouseLeave={() => setActive(null)}>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
						<text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
							{format(t)}
						</text>
					</g>
				))}
				{points.map((p, i) => {
					const cx = M.left + slot * i + slot / 2;
					const x0 = cx - groupW / 2;
					let pile = 0;
					const isActive = active === i;
					return (
						<g key={p.key} className={`barchart__col ${isActive ? 'is-active' : ''}`.trim()} tabIndex={0} aria-label={`${p.tip || p.label}: ${series.map((s) => `${s.label} ${num(p.values[s.key]) === null ? 'no data' : format(p.values[s.key])}`).join(', ')}`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
							<rect x={M.left + slot * i} y={M.top} width={slot} height={innerH} fill="transparent" />
							{series.map((s, si) => {
								const v = num(p.values[s.key]);
								if (v === null) return null;
								const h = Math.max((v / max) * innerH, v > 0 ? 2 : 0);
								const bx = stacked ? x0 : x0 + barW * si;
								const by = stacked ? y(pile + v) : M.top + innerH - h;
								pile += v;
								return <rect key={s.key} className="barchart__bar" x={bx + (stacked ? 0 : 2)} y={by} width={Math.max(barW - (stacked ? 0 : 4), 2)} height={h} rx={Math.min(5, barW / 3)} fill={colorOf(s, si)} opacity={active === null || isActive ? 1 : 0.55} style={{ '--n': i }} />;
							})}
							{showValues && !stacked
								? series.map((s, si) => {
										const v = num(p.values[s.key]);
										return v === null ? null : (
											<text key={s.key} x={x0 + barW * si + barW / 2} y={y(v) - 5} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text)">
												{format(v)}
											</text>
										);
								  })
								: null}
							{showValues && stacked ? (
								<text x={cx} y={y(totalOf(p)) - 5} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text)">
									{format(totalOf(p))}
								</text>
							) : null}
							{i % labelEvery === 0 ? (
								<text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
									{p.label}
								</text>
							) : null}
						</g>
					);
				})}
			</svg>
			{active !== null && points[active] ? (
				<div className="barchart__tip" role="status" style={{ left: `${Math.min(Math.max(((M.left + slot * active + slot / 2) / width) * 100, 12), 88)}%` }}>
					<b>{points[active].tip || points[active].label}</b>
					{series.map((s, si) => (
						<span key={s.key}>
							<i style={{ background: colorOf(s, si) }} />
							{s.label}: {num(points[active].values[s.key]) === null ? 'no data' : format(points[active].values[s.key])}
						</span>
					))}
				</div>
			) : null}
			{series.length > 1 ? (
				<div className="barchart__legend" aria-hidden="true">
					{series.map((s, si) => (
						<span key={s.key}>
							<i style={{ background: colorOf(s, si) }} />
							{s.label}
						</span>
					))}
				</div>
			) : null}
			<table className="sr-only" aria-label={`${ariaLabel || 'Chart'} data`} id={`${id}-t`}>
				<thead>
					<tr>
						<th>Period</th>
						{series.map((s) => (
							<th key={s.key}>{s.label}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{points.map((p) => (
						<tr key={p.key}>
							<th>{p.tip || p.label}</th>
							{series.map((s) => (
								<td key={s.key}>{num(p.values[s.key]) === null ? 'No data' : format(p.values[s.key])}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
