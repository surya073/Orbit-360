import React, { useId } from 'react';

const W = 120;
const H = 36;
const PAD = 3;

/**
 * Tiny trend line with a soft area, for KPI cards. `values` come straight from a backend series;
 * null/undefined values leave a gap (no data is never drawn as zero). Fewer than two real points
 * render nothing, because a single dot is not a trend. Decorative: the same numbers are in the
 * full chart, so it is hidden from assistive technology.
 */
export default function Sparkline({ values, color = 'var(--chart-1)', height = H }) {
	const id = useId().replace(/:/g, '');
	const nums = (values || []).filter((v) => Number.isFinite(v));
	if (nums.length < 2) return null;
	const min = Math.min(...nums);
	const max = Math.max(...nums);
	const span = max - min || 1;
	const x = (i) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
	const y = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2);

	const segments = [];
	let cur = [];
	values.forEach((v, i) => {
		if (Number.isFinite(v)) cur.push([x(i), y(v)]);
		else if (cur.length) {
			segments.push(cur);
			cur = [];
		}
	});
	if (cur.length) segments.push(cur);

	return (
		<svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" height={height} aria-hidden="true" focusable="false">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" style={{ stopColor: color, stopOpacity: 0.32 }} />
					<stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
				</linearGradient>
			</defs>
			{segments.map((seg, k) => {
				if (seg.length < 2) return null;
				const d = seg.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
				return (
					<g key={k}>
						<path d={`${d} L${seg[seg.length - 1][0].toFixed(1)} ${H} L${seg[0][0].toFixed(1)} ${H} Z`} fill={`url(#${id})`} />
						<path className="spark__line" d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
					</g>
				);
			})}
		</svg>
	);
}
