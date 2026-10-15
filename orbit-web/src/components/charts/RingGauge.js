import React from 'react';

const R = 42;
const C = 2 * Math.PI * R;

/**
 * Ring gauge for a percentage the backend computed (billable share, late rate, burn vs estimate).
 * `value` null renders an empty track and a dash: a missing value is never drawn as 0%.
 * Values above 100 fill the ring and switch to `overColor` (over-estimate is a plain fact).
 * `display` is the text in the middle (defaults to the rounded percentage).
 */
export default function RingGauge({ value, display, caption, color = 'var(--chart-1)', overColor = 'var(--chart-5)', size = 104, ariaLabel }) {
	const has = Number.isFinite(value);
	const over = has && value > 100;
	const pct = has ? Math.max(0, Math.min(100, value)) : 0;
	const text = has ? display ?? `${Math.round(value)}%` : '—';
	return (
		<figure className="ring" style={{ width: size }}>
			<svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${ariaLabel || caption || 'Gauge'}: ${has ? text : 'no data'}`}>
				<circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
				{has && pct > 0 ? (
					<circle
						className="ring__arc"
						cx="50"
						cy="50"
						r={R}
						fill="none"
						stroke={over ? overColor : color}
						strokeWidth="9"
						strokeLinecap="round"
						strokeDasharray={`${(pct / 100) * C} ${C}`}
						transform="rotate(-90 50 50)"
						style={{ '--ring-len': (pct / 100) * C }}
					/>
				) : null}
				<text x="50" y={caption ? 52 : 56} textAnchor="middle" className="ring__value">
					{text}
				</text>
				{caption ? (
					<text x="50" y="66" textAnchor="middle" className="ring__caption">
						{caption}
					</text>
				) : null}
			</svg>
		</figure>
	);
}
