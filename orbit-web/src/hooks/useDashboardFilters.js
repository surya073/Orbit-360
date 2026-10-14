import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isValidPeriod } from '../components/filters/DateRangeFilter';
import { resolvePeriod } from '../utils/periods';

const PRESETS = ['this_month', 'last_month', 'last_30_days', 'this_quarter', 'custom'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dashboard filters live in the URL (shareable, survive reload): ?period=&from=&to=&team=&project=
 * `params` is the validated API query (resolved Asia/Kolkata dates). An invalid custom range
 * yields `valid: false` and no request is made.
 */
export default function useDashboardFilters() {
	const [sp, setSp] = useSearchParams();
	const preset = PRESETS.includes(sp.get('period')) ? sp.get('period') : 'this_month';
	const from = DATE.test(sp.get('from') || '') ? sp.get('from') : undefined;
	const to = DATE.test(sp.get('to') || '') ? sp.get('to') : undefined;
	const team = /^\d+$/.test(sp.get('team') || '') ? sp.get('team') : '';
	const project = /^\d+$/.test(sp.get('project') || '') ? sp.get('project') : '';

	const period = useMemo(() => (preset === 'custom' ? { preset, from, to } : { preset }), [preset, from, to]);
	const valid = isValidPeriod(period);
	const params = useMemo(() => {
		const r = valid ? resolvePeriod(period) : {};
		return { ...r, ...(team ? { team_id: team } : {}), ...(project ? { project_id: project } : {}) };
	}, [period, valid, team, project]);

	const update = useCallback(
		(next) => {
			setSp(
				(prev) => {
					const q = new URLSearchParams(prev);
					const set = (k, v) => (v ? q.set(k, v) : q.delete(k));
					if (next.period !== undefined) {
						set('period', next.period.preset === 'this_month' ? '' : next.period.preset);
						set('from', next.period.preset === 'custom' ? next.period.from : '');
						set('to', next.period.preset === 'custom' ? next.period.to : '');
					}
					if (next.team !== undefined) set('team', next.team);
					if (next.project !== undefined) set('project', next.project);
					return q;
				},
				{ replace: true }
			);
		},
		[setSp]
	);

	return { period, team, project, valid, params, update };
}
