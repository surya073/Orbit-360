import { addDays, daysSince } from '../../../utils/periods';
import { formatNumber, humanize } from '../../../utils/format';

/**
 * What each live-data widget on a studio slide shows, taken from the backend metrics a deck already loads (no figure is
 * computed from raw rows here, and a missing figure stays missing: a dash with its reason, never a zero).
 *
 * widgetModel(widget, data, prev) -> { status, kind, value?, unit?, delta?, series?, items?, note? }
 *   data   { overview, trends, projects, highlights } as the dashboard hook returns them ({ status, data })
 *   prev   the previous period's overview ({ status, data }) or null
 */

export const WIDGET_NEEDS = {
	billable_hours: ['overview', 'trends'],
	non_billable_hours: ['overview', 'trends'],
	billable_share: ['overview'],
	headcount: ['overview'],
	late_rate: ['overview', 'trends'],
	approved_leave: ['overview'],
	projects: ['projects'],
	workload: ['projects'],
	top_performers: ['highlights'],
	best_attendance: ['highlights'],
};

const hours = (min) => (Number.isFinite(min) ? Math.round((min / 60) * 10) / 10 : null);
const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

/** The single figure behind a big-number widget, from an overview answer. */
export function kpiOf(metric, overview) {
	if (!overview) return null;
	const t = overview.time;
	switch (metric) {
		case 'billable_hours':
			return t ? { value: hours(num(t.billableMinutes)), unit: 'h', note: t.completeness } : null;
		case 'non_billable_hours':
			return t ? { value: hours(num(t.nonBillableMinutes)), unit: 'h', note: t.completeness } : null;
		case 'billable_share':
			return t ? { value: num(t.billablePercent), unit: '%', note: t.completeness } : null;
		case 'headcount':
			return overview.headcount ? { value: num(overview.headcount.total), unit: '', note: overview.headcount.completeness } : null;
		case 'late_rate':
			return overview.attendance ? { value: num(overview.attendance.lateRatePercent), unit: '%', note: overview.attendance.completeness, lowerIsBetter: true } : null;
		case 'approved_leave':
			return overview.leave ? { value: num(overview.leave.approvedDays), unit: 'days', note: overview.leave.completeness } : null;
		default:
			return null;
	}
}

/** Change against the previous period: { pct, dir: 'up' | 'down' | 'flat', good } or null when either side is unknown or the old value was 0. */
export function deltaOf(now, before, lowerIsBetter = false) {
	if (now === null || before === null || before === undefined || now === undefined || before === 0) return null;
	const pct = Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
	const dir = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat';
	const good = dir === 'flat' ? null : lowerIsBetter ? dir === 'down' : dir === 'up';
	return { pct, dir, good };
}

const share = (parts) => {
	const total = parts.reduce((s, p) => s + p.value, 0);
	return parts.map((p) => ({ ...p, pct: total ? Math.round((p.value / total) * 1000) / 10 : 0 }));
};

const state = (res) => (!res || res.status === 'idle' || (res.status === 'loading' && !res.data) ? 'loading' : res.status === 'error' ? 'error' : 'ready');

export function widgetModel(widget, data, prev) {
	const { type, metric } = widget;
	const top = Math.min(Math.max(Number(widget.top) || 5, 1), 10);
	const need = WIDGET_NEEDS[metric] || [];
	const states = need.map((k) => state(data[k]));
	if (states.includes('error')) return { status: 'error' };
	if (states.includes('loading')) return { status: 'loading' };
	const d = (k) => (data[k] && data[k].data) || null;

	if (type === 'kpi') {
		const now = kpiOf(metric, d('overview'));
		if (!now) return { status: 'ready', kind: 'kpi', value: null };
		let delta = null;
		if (widget.compare && prev && prev.data) delta = deltaOf(now.value, (kpiOf(metric, prev.data) || {}).value, now.lowerIsBetter);
		return { status: 'ready', kind: 'kpi', value: now.value, unit: now.unit, delta, note: now.note === 'partial' ? 'Partly complete: some entries are not approved yet' : null, comparing: Boolean(widget.compare) };
	}

	if (type === 'trend') {
		const trends = d('trends');
		const pickRows = (v) => (Array.isArray(v) ? v : []); // not-applicable answers (project filter) are objects
		const rows = metric === 'late_rate' ? pickRows(trends && trends.attendance) : pickRows(trends && trends.time);
		const pick = metric === 'late_rate' ? (r) => num(r.lateRatePercent) : metric === 'non_billable_hours' ? (r) => hours(num(r.nonBillableMinutes)) : (r) => hours(num(r.billableMinutes));
		const unit = metric === 'late_rate' ? '%' : 'h';
		return { status: 'ready', kind: 'trend', unit, series: rows.map((r) => ({ label: r.start, value: pick(r) })).filter((p) => p.value !== null) };
	}

	if (type === 'donut') {
		if (metric === 'billable_share') {
			const t = (d('overview') || {}).time;
			if (!t) return { status: 'ready', kind: 'donut', items: [] };
			return { status: 'ready', kind: 'donut', unit: 'h', total: hours(num(t.totalMinutes)), totalLabel: 'hours', items: share([{ label: 'Billable', value: hours(num(t.billableMinutes)) || 0 }, { label: 'Non-billable', value: hours(num(t.nonBillableMinutes)) || 0 }]) };
		}
		if (metric === 'headcount') {
			const h = (d('overview') || {}).headcount;
			const items = h && h.byStatus ? Object.entries(h.byStatus).map(([k, v]) => ({ label: humanize(k), value: num(v) || 0 })) : [];
			return { status: 'ready', kind: 'donut', total: h ? num(h.total) : null, totalLabel: 'people', items: share(items) };
		}
		if (metric === 'projects') {
			const s = (d('projects') || {}).status;
			const items = s && s.byStatus ? Object.entries(s.byStatus).map(([k, v]) => ({ label: humanize(k), value: num(v) || 0 })) : [];
			return { status: 'ready', kind: 'donut', total: s ? num(s.total) : null, totalLabel: 'projects', items: share(items) };
		}
		if (metric === 'workload') {
			const w = (((d('projects') || {}).workload || {}).projects || []).slice(0, top);
			const items = w.map((p) => ({ label: p.name, value: hours(num(p.periodMinutes)) || 0 })).filter((p) => p.value > 0);
			return { status: 'ready', kind: 'donut', unit: 'h', total: Math.round(items.reduce((s, p) => s + p.value, 0) * 10) / 10, totalLabel: 'hours', items: share(items) };
		}
		return { status: 'ready', kind: 'donut', items: [] };
	}

	if (type === 'bars') {
		const w = (((d('projects') || {}).workload || {}).projects || []).slice(0, top);
		const items = w
			.map((p) => ({ label: p.name, value: hours(num(p.periodMinutes)) || 0, sub: p.estimatedHours ? `${formatNumber(p.burnPercent, 0)}% of the ${formatNumber(p.estimatedHours, 0)} h estimate` : 'No estimate recorded', status: p.status }))
			.sort((a, b) => b.value - a.value);
		return { status: 'ready', kind: 'bars', unit: 'h', items };
	}

	if (type === 'leaders') {
		const h = d('highlights') || {};
		const rows = (metric === 'best_attendance' ? h.bestAttendance : h.topPerformers) || [];
		const key = metric === 'best_attendance' ? 'days' : 'hours';
		const items = rows.slice(0, top).map((p) => ({ label: p.name, value: num(p[key]) || 0, sub: p.role || null }));
		return { status: 'ready', kind: 'leaders', unit: metric === 'best_attendance' ? 'days' : 'h', items };
	}

	return { status: 'ready', kind: type, items: [] };
}

/** Datasets a list of slides needs for their widgets (so the deck fetches only what its widgets show). */
export function widgetSections(slides) {
	const out = new Set();
	for (const s of slides || []) {
		if (s.type !== 'custom') continue;
		for (const o of s.objects || []) if (o.kind === 'widget' && o.widget) (WIDGET_NEEDS[o.widget.metric] || []).forEach((k) => out.add(k));
	}
	return [...out];
}

/** Does any widget ask for a previous-period comparison? */
export const needsPrevious = (slides) => (slides || []).some((s) => s.type === 'custom' && (s.objects || []).some((o) => o.kind === 'widget' && o.widget && o.widget.type === 'kpi' && o.widget.compare));

/** The period just before `period` ({ from, to }), of the same length: what "previous period" compares with. */
export function previousRange(period) {
	if (!period || !period.from || !period.to) return null;
	const len = daysSince(period.from, period.to) + 1;
	const to = addDays(period.from, -1);
	return { from: addDays(to, -(len - 1)), to };
}
