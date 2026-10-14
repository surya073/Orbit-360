import React from 'react';
import { metricNote } from '../../utils/format';
import Icon from '../common/Icon';
import CompletenessBadge from './CompletenessBadge';

/**
 * Compact KPI. `value` null/undefined renders a dash (never 0) with the reason from `metric`.
 * `loading` shows a skeleton so layout does not jump; `error` shows a short unavailable note.
 */
export default function KpiCard({ label, value, unit, sub, icon, metric, loading, error, delay = 0 }) {
	const missing = value === null || value === undefined;
	const note = metric && metric.completeness !== 'complete' ? metricNote(metric) : null;
	return (
		<section className="card kpi" aria-label={label} style={{ animationDelay: `${delay}ms` }} aria-busy={loading || undefined}>
			<div className="kpi__label">
				{icon ? <Icon name={icon} size={14} /> : null}
				{label}
			</div>
			{loading ? (
				<div className="skeleton" style={{ height: 30, width: '60%', marginTop: 6 }} />
			) : error ? (
				<div className="kpi__value kpi__value--empty" title={error.message}>
					—
				</div>
			) : (
				<div className={`kpi__value ${missing ? 'kpi__value--empty' : ''}`}>
					{missing ? '—' : value}
					{!missing && unit ? <span className="kpi__unit">{unit}</span> : null}
				</div>
			)}
			<div className="kpi__sub">
				{error ? 'Unavailable' : loading ? ' ' : sub}
				{!loading && !error ? <CompletenessBadge metric={metric} /> : null}
			</div>
			{!loading && !error && note ? <div className="kpi__note">{note}</div> : null}
		</section>
	);
}
