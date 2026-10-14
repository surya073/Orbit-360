import React from 'react';
import Button from '../../components/common/Button';
import DateRangeFilter from '../../components/filters/DateRangeFilter';
import FilterBar from '../../components/filters/FilterBar';
import ProjectFilter from '../../components/filters/ProjectFilter';
import TeamFilter from '../../components/filters/TeamFilter';
import PageHeader from '../../components/layout/PageHeader';
import { ROUTES } from '../../config/routes';
import useDashboardFilters from '../../hooks/useDashboardFilters';
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
	const reset = () => f.update({ period: { preset: 'this_month' }, team: '', project: '' });

	return (
		<>
			<PageHeader
				title="Overview"
				description="Company performance at a glance"
				meta={<FreshnessBar res={data.freshness} period={f.valid ? f.params : null} />}
				actions={
					<Button icon="present" to={ROUTES.presentations}>
						Presentations
					</Button>
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
					<KpiRow overview={data.overview} projects={data.projects} />
					<div className="grid grid--2">
						<BillableTrendCard res={data.trends} clamped={data.trendClamped} />
						<AttendanceTrendCard res={data.trends} />
					</div>
					<div className="grid grid--2">
						<ProjectHealthCard res={data.projects} />
						<ProductStatusCard res={data.product} />
					</div>
					<div className="grid grid--2">
						<AiUsageCard res={data.ai} />
						<InsightsCard overview={data.overview} projects={data.projects} product={data.product} freshness={data.freshness} />
					</div>
				</div>
			)}
		</>
	);
}
