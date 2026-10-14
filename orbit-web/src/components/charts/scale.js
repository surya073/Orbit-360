/** Rounds a maximum up to a readable axis ceiling (1, 2, 2.5, 5, 10 x 10^n). Never returns 0. */
export function niceMax(max) {
	if (!Number.isFinite(max) || max <= 0) return 1;
	const exp = Math.floor(Math.log10(max));
	const base = 10 ** exp;
	const f = max / base;
	const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
	return step * base;
}

export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
export const colorAt = (i) => CHART_COLORS[i % CHART_COLORS.length];
