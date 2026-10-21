import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Tabs from '../../components/common/Tabs';
import StateView from '../../components/feedback/StateView';
import PageHeader from '../../components/layout/PageHeader';
import useApiResource from '../../hooks/useApiResource';
import { accessService } from '../../services/accessService';
import OverviewTab from './OverviewTab';
import RolesTab from './RolesTab';
import UsersTab from './UsersTab';

const TABS = [
	{ id: 'overview', label: 'Overview', icon: 'dashboard' },
	{ id: 'roles', label: 'Roles & permissions', icon: 'lock' },
	{ id: 'users', label: 'Users', icon: 'users' },
];

/**
 * Access & Permissions: who can do what, in one place. Roles hold permissions per module and action;
 * people hold a role. The screen only reflects the signed-in user's own permissions (view or manage);
 * the server enforces every rule again on each call.
 */
export default function AccessPage() {
	const [sp, setSp] = useSearchParams();
	const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'overview';
	const catalog = useApiResource((signal) => accessService.catalog({ signal }), 'access-catalog', { isEmpty: () => false });
	const roles = useApiResource((signal) => accessService.roles({ signal }), 'access-roles', { isEmpty: () => false });
	const both = { status: catalog.status === 'error' || roles.status === 'error' ? 'error' : catalog.data && roles.data ? 'success' : 'loading', data: catalog.data && roles.data ? true : null, error: catalog.error || roles.error, reload: () => { catalog.reload(); roles.reload(); } };

	return (
		<>
			<PageHeader title="Access & Permissions" description="Decide who can see and do what. Roles group permissions by module; each person holds one role." />
			<StateView res={both} loadingLines={6}>
				{catalog.data && roles.data ? (
					<div className="access-page">
						<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Access sections" />
						<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="access-panel">
							{tab === 'overview' ? <OverviewTab catalog={catalog.data} data={roles.data} /> : null}
							{tab === 'roles' ? <RolesTab catalog={catalog.data} data={roles.data} reload={roles.reload} /> : null}
							{tab === 'users' ? <UsersTab data={roles.data} catalog={catalog.data} reload={roles.reload} /> : null}
						</div>
					</div>
				) : null}
			</StateView>
		</>
	);
}
