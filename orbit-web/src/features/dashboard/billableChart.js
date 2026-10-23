import { formatDate } from '../../utils/dates';
import { formatNumber, minutesToHours } from '../../utils/format';

/**
 * What the main dashboard chart can show and how. Everything is built from the trends the dashboard already loaded
 * (no extra request). A missing figure is null and leaves a gap; it is never drawn as zero.
 */

const BILLABLE = { key: 'billable', label: 'Billable hours', color: 'var(--accent)' };
const NON_BILLABLE = { key: 'nonBillable', label: 'Non-billable hours', color: 'var(--chart-3)' };

export const CHART_TYPES = { area: 'Area', line: 'Line', bar: 'Bars', stacked: 'Stacked' };

export const METRICS = [
	{ id: 'billable', label: 'Billable hours', series: [BILLABLE], types: ['area', 'line', 'bar'], format: (v) => `${formatNumber(v, v < 10 ? 1 : 0)}h` },
	{ id: 'split', label: 'Billable vs non-billable', series: [BILLABLE, NON_BILLABLE], types: ['bar', 'stacked', 'line'], format: (v) => `${formatNumber(v, v < 10 ? 1 : 0)}h` },
	{ id: 'total', label: 'Total hours', series: [{ key: 'total', label: 'Total hours', color: 'var(--chart-2)' }], types: ['area', 'line', 'bar'], format: (v) => `${formatNumber(v, v < 10 ? 1 : 0)}h` },
	{ id: 'share', label: 'Billable share', series: [{ key: 'share', label: 'Billable share', color: 'var(--chart-4)' }], types: ['area', 'line', 'bar'], format: (v) => `${formatNumber(v, 0)}%` },
	{ id: 'late', label: 'Late check-ins', series: [{ key: 'late', label: 'Late check-ins', color: 'var(--chart-5)' }], types: ['bar', 'line', 'area'], format: (v) => formatNumber(v, 0) },
];

export const metricById = (id) => METRICS.find((m) => m.id === id) || METRICS[0];

/** The chart type to use: the stored choice if this metric supports it, otherwise the metric's first one. */
export const typeFor = (metric, type) => (metric.types.includes(type) ? type : metric.types[0]);

const hours = (min) => (Number.isFinite(min) ? minutesToHours(min) : null);

/** One row per bucket: { key, label, tip, values: { <seriesKey>: number|null } }. */
export function chartRows(metric, trends) {
	if (!trends) return [];
	const per = (trends.filters && trends.filters.granularity) || 'week';
	const late = new Map((Array.isArray(trends.attendance) ? trends.attendance : []).map((a) => [a.start, a]));
	return (Array.isArray(trends.time) ? trends.time : []).map((b) => {
		const billable = hours(b.billableMinutes);
		const non = hours(b.nonBillableMinutes);
		const values = {
			billable,
			nonBillable: non,
			total: billable !== null && non !== null ? billable + non : null,
			share: Number.isFinite(b.billablePercent) ? b.billablePercent : null,
			late: late.has(b.start) && Number.isFinite(late.get(b.start).late) ? late.get(b.start).late : null,
		};
		return { key: b.start, label: formatDate(b.start).slice(0, 6), tip: per === 'day' ? formatDate(b.start) : `Week of ${formatDate(b.start).slice(0, 6)}`, values, metric: metric.id };
	});
}

export const hasAnyValue = (rows, metric) => rows.some((r) => metric.series.some((s) => Number.isFinite(r.values[s.key])));
