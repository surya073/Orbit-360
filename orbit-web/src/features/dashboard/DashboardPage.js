import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import DateRangeFilter from '../../components/filters/DateRangeFilter';
import FilterBar from '../../components/filters/FilterBar';
import ProjectFilter from '../../components/filters/ProjectFilter';
import TeamFilter from '../../components/filters/TeamFilter';
import PageHeader from '../../components/layout/PageHeader';
import { ROUTES } from '../../config/routes';
import useDashboardFilters from '../../hooks/useDashboardFilters';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import DashboardLayoutEditor from './DashboardLayoutEditor';
import useDashboardData from './useDashboardData';
import AiUsageCard from './widgets/AiUsageCard';
import FreshnessBar from './widgets/FreshnessBar';
import InsightsCard from './widgets/InsightsCard';
import KpiRow from './widgets/KpiRow';
import ProductStatusCard from './widgets/ProductStatusCard';
import ProjectHealthCard from './widgets/ProjectHealthCard';
import { AttendanceTrendCard, BillableTrendCard } from './widgets/TrendCards';

/**
 * Executive overview. Everything shown is computed by the backend for the caller's scope
 * (managers: assigned team only). Raw employee/project tables live on the module pages.
 */
export default function DashboardPage() {
	const f = useDashboardFilters();
	const data = useDashboardData(f.params, { enabled: f.valid });
	const layout = useDashboardLayout();
	const [customizing, setCustomizing] = useState(false);
	const reset = () => f.update({ period: { preset: 'this_month' }, team: '', project: '' });

	const widgets = {
		'billable-trend': <BillableTrendCard res={data.trends} clamped={data.trendClamped} />,
		'attendance-trend': <AttendanceTrendCard res={data.trends} />,
		'project-health': <ProjectHealthCard res={data.projects} />,
		'product-status': <ProductStatusCard res={data.product} />,
		'ai-usage': <AiUsageCard res={data.ai} />,
		insights: <InsightsCard overview={data.overview} projects={data.projects} product={data.product} freshness={data.freshness} />,
	};

	return (
		<>
			<PageHeader
				title="Overview"
				description="Company performance at a glance"
				meta={<FreshnessBar res={data.freshness} period={f.valid ? f.params : null} />}
				actions={
					<>
						<Button icon="settings" onClick={() => setCustomizing(true)}>
							Customize
						</Button>
						<Button icon="present" to={ROUTES.presentations}>
							Presentations
						</Button>
					</>
				}
			/>
			<FilterBar label="Dashboard filters">
				<DateRangeFilter value={f.period} onChange={(period) => f.update({ period })} />
				<TeamFilter value={f.team} onChange={(team) => f.update({ team })} />
				<ProjectFilter value={f.project} onChange={(project) => f.update({ project })} />
				<Button variant="ghost" onClick={reset}>
					Reset
				</Button>
			</FilterBar>

			{!f.valid ? (
				<p role="alert" className="banner banner--warning">
					Choose a valid date range (the end date must not be before the start date).
				</p>
			) : (
				<div className="stack">
					{layout.visible.length === 0 ? (
						<p className="banner banner--info" role="status">
							All widgets are hidden. Use Customize to show them again.
						</p>
					) : null}
					{layout.visible.includes('kpis') ? <KpiRow overview={data.overview} projects={data.projects} /> : null}
					<div className="grid grid--widgets">{layout.visible.filter((id) => id !== 'kpis').map((id) => <React.Fragment key={id}>{widgets[id]}</React.Fragment>)}</div>
				</div>
			)}
		{customizing ? (
				<Modal
					title="Customize dashboard"
					onClose={() => setCustomizing(false)}
					footer={
						<Button variant="primary" onClick={() => setCustomizing(false)}>
							Done
						</Button>
					}
				>
					<p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>
						Drag the handle (or use the arrows) to reorder. Switch a widget off to hide it. Saved on this device only; your data access is unchanged.
					</p>
					<DashboardLayoutEditor layout={layout} />
				</Modal>
			) : null}
		</>
	);
}
