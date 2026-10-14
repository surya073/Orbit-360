import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/cards/Card';
import Tabs from '../../components/common/Tabs';
import PageHeader from '../../components/layout/PageHeader';
import ApplicationSettings from './ApplicationSettings';
import ProfilePanel from './ProfilePanel';
import IconStyleSelector from './IconStyleSelector';
import ThemeSelector from './ThemeSelector';

const TABS = [
	{ id: 'appearance', label: 'Appearance' },
	{ id: 'application', label: 'Application' },
	{ id: 'profile', label: 'Profile' },
];

export default function SettingsPage() {
	const [sp, setSp] = useSearchParams();
	const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'appearance';
	return (
		<>
			<PageHeader title="Settings" description="Appearance, application configuration and your profile" />
			<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Settings sections" />
			<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label}>
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
				{tab === 'application' ? <ApplicationSettings /> : null}
				{tab === 'profile' ? <ProfilePanel /> : null}
			</div>
		</>
	);
}
