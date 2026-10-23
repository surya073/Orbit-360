import React from 'react';

/** One proportional bar with a legend of label + value. segments: [{ label, value, color, display? }] */
export default function StackedBar({ segments, ariaLabel }) {
	const total = segments.reduce((s, x) => s + (Number.isFinite(x.value) ? x.value : 0), 0);
	return (
		<div>
			<div className="stackbar" role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${s.display ?? s.value}`).join(', ')}`}>
				{total > 0 ? segments.filter((s) => s.value > 0).map((s) => <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />) : null}
			</div>
			<div className="legend">
				{segments.map((s) => (
					<span key={s.label}>
						<i style={{ background: s.color }} />
						{s.label} <b className="num stackbar__value">{s.display ?? s.value}</b>
					</span>
				))}
			</div>
		</div>
	);
}
