import React from 'react';

/**
 * Slim progress track. `value` and `max` are in the same unit; `marker` draws a tick (e.g. the
 * 100% line of an estimate when `max` is larger so over-runs stay visible). A missing value
 * renders an empty track, never a zero-length bar that looks like 0.
 */
export default function ProgressBar({ value, max = 100, marker, color = 'var(--chart-1)', ariaLabel }) {
	const has = Number.isFinite(value);
	const pct = has ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
	return (
		<span className="progress" role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel ? `${ariaLabel}: ${has ? value : 'no data'}` : undefined} aria-hidden={ariaLabel ? undefined : 'true'}>
			{has ? <span className="progress__fill" style={{ width: `${pct}%`, background: color }} /> : null}
			{marker !== undefined ? <span className="progress__marker" style={{ left: `${Math.min(100, (marker / max) * 100)}%` }} /> : null}
		</span>
	);
}
