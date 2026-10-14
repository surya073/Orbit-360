import React from 'react';
import { colorAt } from './scale';

const R = 44;
const C = 2 * Math.PI * R;

/**
 * Donut with a labelled legend. segments: [{ label, value, color? }]. The legend carries the
 * numbers, so the chart is never the only carrier of information.
 */
export default function DonutChart({ segments, centerLabel, ariaLabel }) {
	const total = segments.reduce((s, x) => s + x.value, 0);
	let offset = 0;
	return (
		<div className="donut">
			<svg viewBox="0 0 120 120" role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
				<circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
				{total > 0
					? segments.map((s, i) => {
							const len = (s.value / total) * C;
							const el = <circle key={s.label} cx="60" cy="60" r={R} fill="none" stroke={s.color || colorAt(i)} strokeWidth="14" strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
							offset += len;
							return el;
					  })
					: null}
				<text x="60" y="58" textAnchor="middle" className="donut__center" fontSize="20">
					{total}
				</text>
				<text x="60" y="73" textAnchor="middle" fontSize="9" fill="var(--text-muted)">
					{centerLabel}
				</text>
			</svg>
			<ul className="donut__list">
				{segments.map((s, i) => (
					<li key={s.label}>
						<i style={{ background: s.color || colorAt(i) }} />
						{s.label}
						<b className="num">{s.value}</b>
					</li>
				))}
			</ul>
		</div>
	);
}
