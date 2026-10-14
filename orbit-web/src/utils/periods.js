import { businessToday } from './dates';

// Reporting periods are Asia/Kolkata business dates. Presets are rolling: a saved presentation
// stores the preset and re-resolves it every time it is presented.
export const PERIOD_PRESETS = [
	{ id: 'this_month', label: 'This month' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'last_30_days', label: 'Last 30 days' },
	{ id: 'this_quarter', label: 'This quarter' },
	{ id: 'custom', label: 'Custom range' },
];

const utc = (s) => Date.parse(`${s}T00:00:00Z`);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => iso(utc(s) + n * 86400000);
const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** period: { preset, from?, to? } -> { from, to } (inclusive). Unknown presets fall back to this month. */
export function resolvePeriod(period, today = businessToday()) {
	const [y, m] = today.split('-').map(Number);
	switch (period && period.preset) {
		case 'custom':
			return { from: period.from, to: period.to };
		case 'last_month': {
			const py = m === 1 ? y - 1 : y;
			const pm = m === 1 ? 12 : m - 1;
			return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` };
		}
		case 'last_30_days':
			return { from: addDays(today, -29), to: today };
		case 'this_quarter': {
			const qs = Math.floor((m - 1) / 3) * 3 + 1;
			return { from: `${y}-${pad(qs)}-01`, to: `${y}-${pad(qs + 2)}-${pad(lastDay(y, qs + 2))}` };
		}
		default:
			return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
	}
}

export const presetLabel = (id) => (PERIOD_PRESETS.find((p) => p.id === id) || PERIOD_PRESETS[0]).label;

/** Trends are limited to 90 days by the API: use the most recent 90 days of the period. */
export const TREND_MAX_DAYS = 90;
export function trendRange({ from, to }) {
	const earliest = addDays(to, -(TREND_MAX_DAYS - 1));
	return from < earliest ? { from: earliest, to, clamped: true } : { from, to, clamped: false };
}

export const daysSince = (dateStr, today = businessToday()) => Math.round((utc(today) - utc(dateStr.slice(0, 10))) / 86400000);
