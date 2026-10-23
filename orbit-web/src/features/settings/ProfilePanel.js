import React from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import Card from '../../components/cards/Card';
import StatusBadge from '../../components/common/StatusBadge';
import useApiResource from '../../hooks/useApiResource';
import { resourceService } from '../../services/resourceService';

/** Read-only view of the verified account as the backend sees it (identity comes from Catalyst). */
export default function ProfilePanel() {
	const { user, can } = useAuth();
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'profile-team', { enabled: Boolean(user.teamId) && can('teams.view'), isEmpty: () => false });
	const team = !user.teamId ? 'All teams' : (teams.data || []).find((t) => String(t.ROWID) === String(user.teamId));
	const rows = [
		['Name', user.displayName],
		['Email', user.email],
		['Role', user.roleName || (user.role === 'admin' ? 'Administrator' : 'Manager')],
		['Team', typeof team === 'string' ? team : team ? team.name : teams.status === 'error' || !can('teams.view') ? 'Assigned team' : '…'],
	];
	return (
		<Card title="Profile" subtitle="Managed by your administrator and Catalyst sign-in">
			<dl className="profile-facts">
				{rows.map(([k, v]) => (
					<React.Fragment key={k}>
						<dt className="muted small">{k}</dt>
						<dd>{v}</dd>
					</React.Fragment>
				))}
			</dl>
			<p className="u-mt-3">
				<StatusBadge tone="success" status="verified" label="Signed in via Catalyst" />
			</p>
		</Card>
	);
}
