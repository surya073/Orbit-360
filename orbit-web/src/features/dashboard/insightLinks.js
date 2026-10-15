import { ROUTES } from '../../config/routes';

/** Where each finding is fixed or explained. Findings the backend raises map to the module page that owns them. */
export function insightLink(id) {
	if (id === 'pending-approval') return ROUTES.time;
	if (id === 'late-unknown') return ROUTES.attendance;
	if (id === 'leave-units') return ROUTES.leave;
	if (id === 'overdue') return ROUTES.product;
	if (id === 'stale-time' || id === 'no-time') return ROUTES.imports;
	if (id.startsWith('over-') || id === 'no-estimate') return ROUTES.projects;
	return null;
}
