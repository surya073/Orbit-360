import React from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import Card from '../../components/cards/Card';
import StatusBadge from '../../components/common/StatusBadge';
import useApiResource from '../../hooks/useApiResource';
import { resourceService } from '../../services/resourceService';

/** Read-only view of the verified account as the backend sees it (identity comes from Catalyst). */
export default function ProfilePanel() {
	const { user } = useAuth();
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'profile-team', { enabled: user.role !== 'admin', isEmpty: () => false });
	const team = user.role === 'admin' ? 'All teams' : (teams.data || []).find((t) => String(t.ROWID) === String(user.teamId));
	const rows = [
		['Name', user.displayName],
		['Email', user.email],
		['Role', user.role === 'admin' ? 'Administrator' : 'Manager'],
		['Team', typeof team === 'string' ? team : team ? team.name : teams.status === 'error' ? 'Unavailable' : '…'],
	];
	return (
		<Card title="Profile" subtitle="Managed by your administrator and Catalyst sign-in">
			<dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', margin: 0 }}>
				{rows.map(([k, v]) => (
					<React.Fragment key={k}>
						<dt className="muted small">{k}</dt>
						<dd style={{ margin: 0 }}>{v}</dd>
					</React.Fragment>
				))}
			</dl>
			<p style={{ marginTop: 12 }}>
				<StatusBadge tone="success" status="verified" label="Signed in via Catalyst" />
			</p>
		</Card>
	);
}
