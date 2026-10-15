import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import DateRangeFilter from '../../components/filters/DateRangeFilter';
import FilterBar from '../../components/filters/FilterBar';
import ProjectFilter from '../../components/filters/ProjectFilter';
import TeamFilter from '../../components/filters/TeamFilter';
import useDashboardFilters from '../../hooks/useDashboardFilters';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import DashboardLayoutEditor from './DashboardLayoutEditor';
import { EntranceContext, useDashboardEntrance } from './entrance';
import { AttentionCard, BillableCard, SidePanel, WorkloadCard } from './signature/Signature';
import useDashboardData from './useDashboardData';
import AiUsageCard from './widgets/AiUsageCard';
import FreshnessBar from './widgets/FreshnessBar';
import InsightsCard from './widgets/InsightsCard';
import KpiRow from './widgets/KpiRow';
import ProductStatusCard from './widgets/ProductStatusCard';
import ProjectHealthCard from './widgets/ProjectHealthCard';
import PeopleLeaveCard from './widgets/PeopleLeaveCard';
import TimeBreakdownCard from './widgets/TimeBreakdownCard';
import { AttendanceTrendCard } from './widgets/TrendCards';

// Widgets with enough content to use the full row.
const WIDE = ['time-breakdown', 'people-leave', 'project-health', 'insights'];

/**
 * Executive overview. The signature section (billable hours, team snapshot, needs attention, workload)
 * follows the reference design; the key metrics and the customizable widgets follow it. Everything shown
 * is computed by the backend for the caller's scope (managers: assigned team only).
 */
export default function DashboardPage() {
	const f = useDashboardFilters();
	const data = useDashboardData(f.params, { enabled: f.valid });
	const layout = useDashboardLayout();
	const [customizing, setCustomizing] = useState(false);
	const entrance = useDashboardEntrance(); // 'cinematic' on the first visit of a session, else 'quick'
	const reset = () => f.update({ period: { preset: 'this_month' }, team: '', project: '' });
	const setPreset = (preset) => f.update({ period: { preset } });

	const widgets = {
		'attendance-trend': <AttendanceTrendCard res={data.trends} highlights />,
		'time-breakdown': <TimeBreakdownCard res={data.overview} />,
		'people-leave': <PeopleLeaveCard res={data.overview} />,
		'project-health': <ProjectHealthCard res={data.projects} drill />,
		'product-status': <ProductStatusCard res={data.product} drill />,
		'ai-usage': <AiUsageCard res={data.ai} drill />,
		insights: <InsightsCard overview={data.overview} projects={data.projects} product={data.product} freshness={data.freshness} drill />,
	};
	const extras = layout.visible.filter((id) => widgets[id]);

	return (
		<EntranceContext.Provider value={entrance === 'cinematic'}>
			<div className={`dash dash--${entrance}`}>
				<section className="sig-context" aria-label="Overview filters">
					<div className="sig-context__text">
						<h1 className="sig-context__title">Overview</h1>
						<FreshnessBar res={data.freshness} period={f.valid ? f.params : null} />
					</div>
					<FilterBar label="Dashboard filters">
						<DateRangeFilter value={f.period} onChange={(period) => f.update({ period })} />
						<TeamFilter value={f.team} onChange={(team) => f.update({ team })} />
						<ProjectFilter value={f.project} onChange={(project) => f.update({ project })} />
						<Button variant="ghost" onClick={reset}>
							Reset
						</Button>
					</FilterBar>
				</section>

				{!f.valid ? (
					<p role="alert" className="banner banner--warning">
						Choose a valid date range (the end date must not be before the start date).
					</p>
				) : (
					<div className="stack">
						<div className="sig-grid">
							<BillableCard overview={data.overview} trends={data.trends} clamped={data.trendClamped} preset={f.period.preset} onPreset={setPreset} />
							<SidePanel overview={data.overview} projects={data.projects} onCustomize={() => setCustomizing(true)} />
							<AttentionCard overview={data.overview} projects={data.projects} product={data.product} freshness={data.freshness} />
							<WorkloadCard projects={data.projects} preset={f.period.preset} onPreset={setPreset} />
						</div>
						{layout.visible.includes('kpis') ? <KpiRow overview={data.overview} projects={data.projects} trends={data.trends} /> : null}
						{extras.length ? (
							<div className="grid grid--widgets">
								{extras.map((id, i) => (
									<div key={id} className={`widget ${WIDE.includes(id) ? 'widget--wide' : ''}`.trim()} style={{ '--i': i }}>
										{widgets[id]}
									</div>
								))}
							</div>
						) : null}
						{layout.visible.length === 0 ? (
							<p className="banner banner--info" role="status">
								The extra widgets are hidden. Use Customize to show them again.
							</p>
						) : null}
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
							Drag the handle (or use the arrows) to reorder the widgets below the overview. Switch a widget off to hide it. Saved on this device only; your data access is unchanged.
						</p>
						<DashboardLayoutEditor layout={layout} />
					</Modal>
				) : null}
			</div>
		</EntranceContext.Provider>
	);
}
