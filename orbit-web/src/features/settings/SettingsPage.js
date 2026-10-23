import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/cards/Card';
import Tabs from '../../components/common/Tabs';
import PageHeader from '../../components/layout/PageHeader';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import DashboardLayoutEditor from '../dashboard/DashboardLayoutEditor';
import AppearanceStudio from './AppearanceStudio';
import DataPanel from './DataPanel';
import ProfilePanel from './ProfilePanel';

// Personal preferences only (they never change what anyone may do). Three places, not ten: how it looks, what the
// dashboard shows, and you. Older links (?tab=layout / data / profile) still land in the right place.
const TABS = [
	{ id: 'appearance', label: 'Appearance', icon: 'palette' },
	{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
	{ id: 'account', label: 'Account', icon: 'user' },
];
const LEGACY = { layout: 'dashboard', data: 'account', profile: 'account' };

function DashboardPanel() {
	const layout = useDashboardLayout();
	return (
		<Card title="Dashboard widgets" subtitle="Drag to reorder or switch widgets off. Saved on this device; your data access is unchanged.">
			<DashboardLayoutEditor layout={layout} />
		</Card>
	);
}

function AccountPanel() {
	return (
		<div className="stack">
			<ProfilePanel />
			<DataPanel />
		</div>
	);
}

export default function SettingsPage() {
	const [sp, setSp] = useSearchParams();
	const asked = LEGACY[sp.get('tab')] || sp.get('tab');
	const tab = TABS.some((t) => t.id === asked) ? asked : 'appearance';
	return (
		<>
			<PageHeader title="Settings" description="How the app looks, what the dashboard shows, and your account. Roles and permissions are under User management." />
			<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Settings sections" />
			<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="settings-panel u-mt-4">
				{tab === 'appearance' ? <AppearanceStudio /> : null}
				{tab === 'dashboard' ? <DashboardPanel /> : null}
				{tab === 'account' ? <AccountPanel /> : null}
			</div>
		</>
	);
}
