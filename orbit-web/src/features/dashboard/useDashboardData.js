import { useMemo } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import useApiResource from '../../hooks/useApiResource';
import { dashboardService } from '../../services/dashboardService';
import { daysSince, trendRange } from '../../utils/periods';

const never = () => false;

/**
 * One independent request per widget so a failure or slow query only affects that card.
 * `params` = { from, to, team_id?, project_id? } (validated). Managers never send team_id; the
 * backend pins them to their team anyway. `sections` limits which requests run (presentations
 * only fetch what their slides need).
 */
export default function useDashboardData(params, { enabled = true, sections } = {}) {
	const { user } = useAuth();
	const want = (s) => enabled && (!sections || sections.includes(s));

	const base = useMemo(() => {
		const p = { ...params };
		if (user.role !== 'admin') delete p.team_id;
		return p;
	}, [params, user.role]);
	const key = JSON.stringify(base);

	const trend = useMemo(() => {
		if (!base.from) return null;
		const r = trendRange(base);
		const spanDays = daysSince(r.from, r.to) + 1; // inclusive length of the (clamped) window
		return { ...base, from: r.from, to: r.to, granularity: spanDays <= 21 ? 'day' : 'week', clamped: r.clamped };
	}, [base]);
	const { clamped, ...trendParams } = trend || {};
	const trendKey = JSON.stringify(trendParams);

	return {
		overview: useApiResource((s) => dashboardService.overview(base, { signal: s }), `ov|${key}`, { enabled: want('overview'), isEmpty: never }),
		trends: useApiResource((s) => dashboardService.trends(trendParams, { signal: s }), `tr|${trendKey}`, { enabled: want('trends') && Boolean(trend), isEmpty: never }),
		projects: useApiResource((s) => dashboardService.projects(base, { signal: s }), `pr|${key}`, { enabled: want('projects'), isEmpty: never }),
		product: useApiResource((s) => dashboardService.product(base, { signal: s }), `pd|${key}`, { enabled: want('product'), isEmpty: never }),
		ai: useApiResource((s) => dashboardService.aiUsage(base, { signal: s }), `ai|${key}`, { enabled: want('ai'), isEmpty: never }),
		freshness: useApiResource((s) => dashboardService.freshness(base, { signal: s }), `fr|${key}`, { enabled: want('freshness'), isEmpty: never }),
		trendClamped: Boolean(clamped),
	};
}
