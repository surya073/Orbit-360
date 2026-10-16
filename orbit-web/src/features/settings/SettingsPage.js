import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../../app/providers/ThemeProvider';
import Card from '../../components/cards/Card';
import Tabs from '../../components/common/Tabs';
import PageHeader from '../../components/layout/PageHeader';
import { MOTIONS, RADII, TEXT_SIZES, WIDTHS } from '../../config/themes';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import DashboardLayoutEditor from '../dashboard/DashboardLayoutEditor';
import AccentPicker from './AccentPicker';
import DataPanel from './DataPanel';
import DensitySelector from './DensitySelector';
import IconStyleSelector from './IconStyleSelector';
import OptionGroup from './OptionGroup';
import ProfilePanel from './ProfilePanel';
import ThemeSelector from './ThemeSelector';

// Personal preferences only (they never change what anyone may do). ids are linked from the account menu (?tab=...).
const TABS = [
	{ id: 'appearance', label: 'Appearance', icon: 'palette' },
	{ id: 'layout', label: 'Layout', icon: 'dashboard' },
	{ id: 'data', label: 'Backup', icon: 'download' },
	{ id: 'profile', label: 'Profile', icon: 'user' },
];

function AppearancePanel() {
	const { radius, textSize, motion, setAppearance } = useTheme();
	return (
		<div className="stack">
			<Card title="Theme" subtitle="29 themes, dark and light. It applies immediately across the app.">
				<ThemeSelector />
			</Card>
			<Card title="Accent colour" subtitle="Keep the theme's own accent, or put your colour on top of any theme.">
				<AccentPicker />
			</Card>
			<Card title="Shape, text and motion" subtitle="How rounded, how big and how animated the interface feels.">
				<div className="optlist">
					<div>
						<h3 className="optlist__title">Corners</h3>
						<OptionGroup label="Corner style" options={RADII} value={radius} onChange={(v) => setAppearance({ radius: v })} />
					</div>
					<div>
						<h3 className="optlist__title">Text size</h3>
						<OptionGroup label="Text size" options={TEXT_SIZES} value={textSize} onChange={(v) => setAppearance({ textSize: v })} />
					</div>
					<div>
						<h3 className="optlist__title">Motion</h3>
						<OptionGroup label="Motion" options={MOTIONS} value={motion} onChange={(v) => setAppearance({ motion: v })} />
					</div>
				</div>
			</Card>
			<Card title="Icon style" subtitle="Pick how icons look everywhere in the app.">
				<IconStyleSelector />
			</Card>
		</div>
	);
}

function LayoutPanel() {
	const layout = useDashboardLayout();
	const { width, setAppearance } = useTheme();
	return (
		<div className="stack">
			<Card title="Density" subtitle="How much fits on screen in tables and controls.">
				<DensitySelector />
			</Card>
			<Card title="Page width" subtitle="How wide the content may grow on large screens.">
				<OptionGroup label="Page width" options={WIDTHS} value={width} onChange={(v) => setAppearance({ width: v })} />
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
			<PageHeader title="Settings" description="Appearance, layout, backup and your profile. Roles and permissions live under Access." />
			<div className="settings-layout">
				<Tabs tabs={TABS} value={tab} onChange={(id) => setSp({ tab: id }, { replace: true })} label="Settings sections" orientation="vertical" />
				<div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="settings-panel">
					{tab === 'appearance' ? <AppearancePanel /> : null}
					{tab === 'layout' ? <LayoutPanel /> : null}
					{tab === 'data' ? <DataPanel /> : null}
					{tab === 'profile' ? <ProfilePanel /> : null}
				</div>
			</div>
		</>
	);
}
