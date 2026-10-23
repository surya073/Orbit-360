import { useMemo } from 'react';
import useApiResource from '../../../hooks/useApiResource';
import { dashboardService } from '../../../services/dashboardService';
import { resolvePeriod } from '../../../utils/periods';
import useDashboardData from '../../dashboard/useDashboardData';
import { needsPrevious, previousRange, widgetSections } from './widgetData';

/**
 * Live figures for the widgets of a deck in the editor: only the datasets its widgets use, for the deck's period and
 * scope, plus the previous period's overview when a big number compares with it. Everything is cached by the API
 * client, so moving between slides costs nothing.
 */
export default function useWidgetData(slides, { period, team, project, enabled = true }) {
	const needed = useMemo(() => widgetSections(slides), [slides]);
	const range = useMemo(() => {
		try {
			return period && (period.preset !== 'custom' || (period.from && period.to)) ? resolvePeriod(period) : null;
		} catch {
			return null;
		}
	}, [period]);
	const scope = useMemo(() => ({ ...(team ? { team_id: team } : {}), ...(project ? { project_id: project } : {}) }), [team, project]);
	const params = useMemo(() => (range ? { ...range, ...scope } : {}), [range, scope]);
	const on = enabled && Boolean(range) && needed.length > 0;
	const data = useDashboardData(params, { enabled: on, sections: needed });
	const prevRange = useMemo(() => previousRange(range), [range]);
	const prev = useApiResource((signal) => dashboardService.overview({ ...prevRange, ...scope }, { signal }), `studio-prev|${prevRange && prevRange.from}|${prevRange && prevRange.to}|${team || ''}|${project || ''}`, { enabled: on && Boolean(prevRange) && needsPrevious(slides), isEmpty: () => false });
	return { data, prev };
}
