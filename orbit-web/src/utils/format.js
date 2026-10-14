// Display helpers. Missing/unavailable values render as an explicit dash, never as 0.
export const EMPTY = '—';

export const isMissing = (v) => v === null || v === undefined || v === '';

export function formatMinutes(min) {
	if (isMissing(min)) return EMPTY;
	const n = Number(min);
	if (!Number.isFinite(n)) return EMPTY;
	const h = Math.floor(n / 60);
	const m = Math.round(n % 60);
	return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatPercent(p) {
	if (isMissing(p) || !Number.isFinite(Number(p))) return EMPTY;
	return `${Number(p).toFixed(1)}%`;
}

export function formatNumber(n, digits = 0) {
	if (isMissing(n) || !Number.isFinite(Number(n))) return EMPTY;
	return Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits });
}

export function formatBool(b) {
	if (b === null || b === undefined) return EMPTY;
	return b ? 'Yes' : 'No';
}

const ACRONYMS = { ai: 'AI', github: 'GitHub', csv: 'CSV', ist: 'IST' };

/** "on_leave" -> "On leave"; known acronyms keep their casing ("ai" -> "AI"). */
export const humanize = (s) => {
	if (isMissing(s)) return EMPTY;
	const raw = String(s);
	if (ACRONYMS[raw.toLowerCase()]) return ACRONYMS[raw.toLowerCase()];
	return raw.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

const MISSING_REASONS = {
	pending_approval: 'Some time entries are still pending approval and are excluded.',
	late_status_unknown: 'Some attendance records have an unknown late status and are excluded from the rate.',
	units_not_recorded: 'Some leave records have no units recorded.',
	status_not_recorded: 'Some records have no status.',
	estimate_not_recorded: 'Some projects have no estimated hours.',
	result_truncated: 'The result was truncated at the query limit.',
	reporting_period_not_recorded: 'Some usage records have no reporting period and are excluded.',
};

/** Explains why a metric is not fully reliable (completeness: complete | partial | insufficient_data | not_applicable). */
export function metricNote(metric) {
	if (!metric) return null;
	if (metric.completeness === 'insufficient_data') return 'No data for this selection.';
	if (metric.completeness === 'not_applicable') return metric.reason || 'Not available for this selection.';
	if (metric.completeness === 'partial') return MISSING_REASONS[metric.missing] || 'Some inputs are missing.';
	return null;
}

/** Minutes -> hours with one decimal for KPI display; missing stays missing (null). */
export function minutesToHours(min) {
	if (isMissing(min) || !Number.isFinite(Number(min))) return null;
	return Math.round((Number(min) / 60) * 10) / 10;
}

export const COMPLETENESS_LABEL = {
	complete: 'Complete',
	partial: 'Partial',
	insufficient_data: 'No data',
	not_applicable: 'Not applicable',
};
