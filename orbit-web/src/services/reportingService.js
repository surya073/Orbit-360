import { api } from './apiClient';

/** Reporting structure of one team: the saved tree plus the team's real employee roster. */
export const reportingService = {
	get: (teamId, o) => api.get('/reporting-structure', { ...o, params: teamId ? { team_id: teamId } : {} }),
	save: (teamId, nodes) => api.put('/reporting-structure', { ...(teamId ? { team_id: teamId } : {}), nodes }),
};
