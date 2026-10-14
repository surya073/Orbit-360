import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/cards/Card';
import Tabs from '../../components/common/Tabs';
import PageHeader from '../../components/layout/PageHeader';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import ApplicationSettings from './ApplicationSettings';
import DashboardLayoutEditor from '../dashboard/DashboardLayoutEditor';
import DensitySelector from './DensitySelector';
import IconStyleSelector from './IconStyleSelector';
import ProfilePanel from './ProfilePanel';
import ThemeSelector from './ThemeSelector';

// Every category holds real, working settings. ids are linked from the user menu (?tab=...).
const TABS = [
	{ id: 'appearance', label: 'Appearance', icon: 'palette' },
	{ id: 'layout', label: 'Layout', icon: 'dashboard' },
	{ id: 'application', label: 'Application', icon: 'settings' },
	{ id: 'profile', label: 'Profile', icon: 'user' },
];

function LayoutPanel() {
	const layout = useDashboardLayout();
	return (
		<div className="stack">
			<Card title="Density" subtitle="How much fits on screen in tables and controls.">
				<DensitySelector />
			</Card>
			<Card title="Dashboard widgets" subtitle="Reorder or hide the widgets on the Overview page. Saved on this device; your data access is unchanged.">
				<DashboardLayoutEditor layout={layout} />
			</Card>
		</div>
	);
}

export default function SettingsPage() {
	const [sp, setSp] = useSearchParams();
	const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'appearance';
	return (
		<>
			<PageHeader title="Settings" description="Appearance, layout, application configuration and your profile" />
			<div className="settings-layout">
				<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Settings sections" orientation="vertical" />
				<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="settings-panel">
					{tab === 'appearance' ? (
						<div className="stack">
							<Card title="Theme" subtitle="Choose a theme. It applies immediately across the app.">
								<ThemeSelector />
							</Card>
							<Card title="Icon style" subtitle="Pick how icons look everywhere in the app.">
								<IconStyleSelector />
							</Card>
						</div>
					) : null}
					{tab === 'layout' ? <LayoutPanel /> : null}
					{tab === 'application' ? <ApplicationSettings /> : null}
					{tab === 'profile' ? <ProfilePanel /> : null}
				</div>
			</div>
		</>
	);
}
