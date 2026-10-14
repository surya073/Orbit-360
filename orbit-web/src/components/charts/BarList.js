import React from 'react';
import { colorAt } from './scale';

/**
 * Horizontal bars with labels and values (accessible as a list; values are text, not just length).
 * items: [{ id, label, value, display?, max?, note?, color? }]. `max` defaults to the largest value.
 * A null/undefined value renders "—" with an empty track (not a zero-length bar that looks like 0).
 */
export default function BarList({ items, ariaLabel }) {
	const max = Math.max(1, ...items.map((i) => (i.max !== undefined ? i.max : Number.isFinite(i.value) ? i.value : 0)));
	return (
		<ul className="barlist" aria-label={ariaLabel}>
			{items.map((it, idx) => {
				const has = Number.isFinite(it.value);
				const pct = has ? Math.min(100, (it.value / (it.max !== undefined ? it.max : max)) * 100) : 0;
				return (
					<li key={it.id} className="barlist__row">
						<span className="barlist__label" title={it.label}>
							{it.label}
						</span>
						<span className="barlist__track" aria-hidden="true">
							{has ? <span className="barlist__fill" style={{ display: 'block', width: `${pct}%`, background: it.color || colorAt(idx) }} /> : null}
						</span>
						<span className="num">
							{has ? it.display ?? it.value : '—'}
							{it.note ? <span className="small muted"> {it.note}</span> : null}
						</span>
					</li>
				);
			})}
		</ul>
	);
}
