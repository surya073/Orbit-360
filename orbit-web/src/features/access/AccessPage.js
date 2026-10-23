import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import Tabs from '../../components/common/Tabs';
import StateView from '../../components/feedback/StateView';
import PageHeader from '../../components/layout/PageHeader';
import useApiResource from '../../hooks/useApiResource';
import { accessService } from '../../services/accessService';
import { resourceService } from '../../services/resourceService';
import InviteModal from './InviteModal';
import OverviewTab from './OverviewTab';
import RolesTab from './RolesTab';
import UserPermissionsModal from './UserPermissionsModal';
import UsersTab from './UsersTab';

const TABS = [
	{ id: 'overview', label: 'Overview', icon: 'dashboard' },
	{ id: 'roles', label: 'Roles & permissions', icon: 'lock' },
	{ id: 'users', label: 'Users', icon: 'users' },
];

/**
 * User management: who can do what, in one place (Overview, Roles & permissions, Users). Roles hold permissions per
 * module and action; people hold a role. "Invite user" is in the page header, so adding someone is one click from
 * any tab, and a person's individual permissions open as soon as the invitation is sent if asked for. The screen
 * only reflects the signed-in user's own permissions (view or manage); the server enforces every rule on each call.
 */
export default function AccessPage() {
	const { can, user } = useAuth();
	const [sp, setSp] = useSearchParams();
	const [inviting, setInviting] = useState(false);
	const [permsFor, setPermsFor] = useState(null);
	const [version, setVersion] = useState(0); // bumps after a change made from the header, so the lists reload
	const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'overview';
	const catalog = useApiResource((signal) => accessService.catalog({ signal }), 'access-catalog', { isEmpty: () => false });
	const roles = useApiResource((signal) => accessService.roles({ signal }), 'access-roles', { isEmpty: () => false });
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'access-teams', { enabled: can('teams.view'), isEmpty: () => false });
	const canInvite = can('access.manage_users') && Boolean(roles.data && roles.data.tablesReady);
	const both = { status: catalog.status === 'error' || roles.status === 'error' ? 'error' : catalog.data && roles.data ? 'success' : 'loading', data: catalog.data && roles.data ? true : null, error: catalog.error || roles.error, reload: () => { catalog.reload(); roles.reload(); } };

	return (
		<>
<PageHeader
				title="User management"
				description="Add people, give each one a role, and decide who can see and do what."
				actions={
					canInvite ? (
						<Button variant="primary" icon="plus" onClick={() => setInviting(true)}>
							Invite user
						</Button>
					) : null
				}
			/>
			<StateView res={both} loadingLines={6}>
				{catalog.data && roles.data ? (
					<div className="access-page">
						<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Access sections" />
						<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="access-panel">
							{tab === 'overview' ? <OverviewTab catalog={catalog.data} data={roles.data} /> : null}
							{tab === 'roles' ? <RolesTab catalog={catalog.data} data={roles.data} reload={roles.reload} /> : null}
{tab === 'users' ? <UsersTab data={roles.data} catalog={catalog.data} reload={roles.reload} version={version} onPermissions={setPermsFor} /> : null}
						</div>
					</div>
				) : null}
			</StateView>
			{inviting && roles.data ? (
				<InviteModal
					roles={roles.data.roles}
					teams={teams.data || []}
					canPickTeam={user.scopeType === 'all_teams' && can('teams.view')}
					ownTeamId={user.scopeType === 'all_teams' ? '' : user.teamId}
					onClose={() => setInviting(false)}
					onInvited={(created, opts = {}) => {
						if (!opts.keepOpen) setInviting(false);
						setVersion((v) => v + 1);
						roles.reload();
						if (opts.fineTune && created) setPermsFor({ id: created.id, displayName: created.displayName || opts.name || opts.email, email: opts.email });
					}}
				/>
			) : null}
			{permsFor && catalog.data ? (
				<UserPermissionsModal
					person={permsFor}
					catalog={catalog.data}
					onClose={() => setPermsFor(null)}
					onSaved={() => {
						setPermsFor(null);
						setVersion((v) => v + 1);
					}}
				/>
			) : null}
		</>
	);
}
