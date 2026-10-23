import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { metricNote } from '../../utils/format';
import ProgressBar from '../charts/ProgressBar';
import Sparkline from '../charts/Sparkline';
import Icon from '../common/Icon';
import { CountUp, prefersReducedMotion, useCinematic } from '../../features/dashboard/entrance';
import CompletenessBadge from './CompletenessBadge';

/**
 * Compact KPI. `value` null/undefined renders a dash (never 0) with the reason from `metric`.
 * `loading` shows a skeleton so layout does not jump; `error` shows a short unavailable note.
 *
 * Optional richness (all derived from backend data the caller already holds):
 *   spark    series of numbers for a trend line (needs >= 2 real points)
 *   progress { value, max?, color? } slim bar, e.g. billable share
 *   hint     one plain sentence saying what the number means
 *   to       module page to drill into (needs a Router)
 *   accent   chart token for the icon chip / sparkline, e.g. 'var(--chart-3)'
 */
export default function KpiCard({ label, value, unit, sub, icon, metric, loading, error, delay = 0, spark, progress, hint, to, accent = 'var(--chart-1)' }) {
	const missing = value === null || value === undefined;
	const note = metric && metric.completeness !== 'complete' ? metricNote(metric) : null;
	const rich = Boolean(spark || progress || hint || to);
	const live = !loading && !error;
	const labelId = useId();
	// Only inside a dashboard playing its cinematic entrance (never in tests or with reduced motion).
	const cinematic = useCinematic();
	const countUp = cinematic && process.env.NODE_ENV !== 'test' && !prefersReducedMotion();
	return (
		<section className={`card kpi ${rich ? 'kpi--rich' : ''}`.trim()} aria-label={label} style={cinematic ? { '--kpi-accent': accent } : { animationDelay: `${delay}ms`, '--kpi-accent': accent }} aria-busy={loading || undefined}>
			<div className="kpi__label" id={labelId}>
				{icon ? (
					<span className="kpi__icon" aria-hidden="true">
						<Icon name={icon} size={14} />
					</span>
				) : null}
				{label}
			</div>
			{loading ? (
				<div className="skeleton kpi__skeleton" />
			) : error ? (
				<div className="kpi__value kpi__value--empty" title={error.message}>
					—
				</div>
			) : (
				<div className={`kpi__value ${missing ? 'kpi__value--empty' : ''}`}>
					{missing ? '—' : <CountUp text={value} enabled={countUp} />}
					{!missing && unit ? <span className="kpi__unit">{unit}</span> : null}
				</div>
			)}
			<div className="kpi__sub">
				{error ? 'Unavailable' : loading ? ' ' : sub}
				{live ? <CompletenessBadge metric={metric} /> : null}
			</div>
			{live && progress && Number.isFinite(progress.value) ? (
				<div className="kpi__bar">
					<ProgressBar value={progress.value} max={progress.max} color={progress.color || accent} />
				</div>
			) : null}
			{live && spark ? (
				<div className="kpi__spark">
					<Sparkline values={spark} color={accent} />
				</div>
			) : null}
			{live && hint ? <div className="kpi__hint">{hint}</div> : null}
			{live && note ? <div className="kpi__note">{note}</div> : null}
			{live && to ? (
				<Link className="kpi__go" to={to} aria-describedby={labelId}>
					View details
					<Icon name="chevronRight" size={12} />
				</Link>
			) : null}
		</section>
	);
}
