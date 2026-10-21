import { useMemo } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { ApiClientError } from '../../services/apiClient';
import { dashboardService } from '../../services/dashboardService';
import { daysSince, trendRange } from '../../utils/periods';

const never = () => false;

/**
 * The dashboard asks the backend for all of its sections in ONE request (/dashboard/bundle: one function invocation
 * instead of six; each section still succeeds or fails on its own, so a failure only affects that card). Quick filter
 * changes are collapsed: only the value that stays put for 450 ms is requested.
 *
 * Presentations pass `sections` and keep the per-section requests, because a slide fetches only what it shows.
 *
 * Old doc: one independent request per widget so a failure or slow query only affects that card.
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

	const legacy = Boolean(sections);
	const bundleParams = useMemo(() => (trend ? { ...base, trend_from: trendParams.from, trend_to: trendParams.to, granularity: trendParams.granularity } : null), [base, trend]); // eslint-disable-line react-hooks/exhaustive-deps
	const settled = useDebouncedValue(JSON.stringify(bundleParams), 450);
	const bundle = useApiResource((s) => dashboardService.bundle(JSON.parse(settled), { signal: s }), `bd|${settled}`, { enabled: enabled && !legacy && Boolean(bundleParams), isEmpty: never });

	// one section of the bundle, shaped like a normal resource so every card works unchanged
	const part = (name) => {
		if (bundle.status === 'error') return bundle;
		if (bundle.status !== 'success') return { status: bundle.status === 'idle' ? 'idle' : 'loading', data: null, meta: null, error: null, reload: bundle.reload };
		const p = bundle.data && bundle.data[name];
		if (p && p.ok) return { status: 'success', data: p.data, meta: null, error: null, reload: bundle.reload };
		const e = (p && p.error) || {};
		return { status: 'error', data: null, meta: null, error: new ApiClientError({ status: e.status || 500, code: e.code || 'HTTP_ERROR', message: e.message || 'This section could not be loaded.' }), reload: bundle.reload };
	};

	const own = {
		overview: useApiResource((s) => dashboardService.overview(base, { signal: s }), `ov|${key}`, { enabled: legacy && want('overview'), isEmpty: never }),
		trends: useApiResource((s) => dashboardService.trends(trendParams, { signal: s }), `tr|${trendKey}`, { enabled: legacy && want('trends') && Boolean(trend), isEmpty: never }),
		projects: useApiResource((s) => dashboardService.projects(base, { signal: s }), `pr|${key}`, { enabled: legacy && want('projects'), isEmpty: never }),
		product: useApiResource((s) => dashboardService.product(base, { signal: s }), `pd|${key}`, { enabled: legacy && want('product'), isEmpty: never }),
		ai: useApiResource((s) => dashboardService.aiUsage(base, { signal: s }), `ai|${key}`, { enabled: legacy && want('ai'), isEmpty: never }),
		freshness: useApiResource((s) => dashboardService.freshness(base, { signal: s }), `fr|${key}`, { enabled: legacy && want('freshness'), isEmpty: never }),
	};

	return {
		overview: legacy ? own.overview : part('overview'),
		trends: legacy ? own.trends : part('trends'),
		projects: legacy ? own.projects : part('projects'),
		product: legacy ? own.product : part('product'),
		ai: legacy ? own.ai : part('ai'),
		freshness: legacy ? own.freshness : part('freshness'),
		trendClamped: Boolean(clamped),
	};
}
