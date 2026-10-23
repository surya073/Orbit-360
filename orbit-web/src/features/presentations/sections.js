import React from 'react';
import KpiCard from '../../components/cards/KpiCard';
import DonutChart from '../../components/charts/DonutChart';
import { colorAt } from '../../components/charts/scale';
import EmptyState from '../../components/feedback/EmptyState';
import StateView from '../../components/feedback/StateView';
import Card from '../../components/cards/Card';
import { formatNumber, humanize, minutesToHours } from '../../utils/format';
import AiUsageCard from '../dashboard/widgets/AiUsageCard';
import InsightsCard from '../dashboard/widgets/InsightsCard';
import KpiRow from '../dashboard/widgets/KpiRow';
import ProductStatusCard from '../dashboard/widgets/ProductStatusCard';
import ProjectHealthCard from '../dashboard/widgets/ProjectHealthCard';
import { AttendanceTrendCard, BillableTrendCard } from '../dashboard/widgets/TrendCards';
import { widgetSections } from './studio/widgetData';

/** Which backend datasets each section needs, so a deck only fetches what its slides use. */
export const SECTION_NEEDS = {
	executive_summary: ['overview', 'projects', 'product', 'freshness'],
	employee_overview: ['overview'],
	attendance_leave: ['overview', 'trends'],
	project_performance: ['projects'],
	billable_hours: ['overview', 'trends'],
	product_development: ['product'],
	ai_usage: ['ai'],
	key_insights: ['overview', 'projects', 'product', 'freshness'],
	reporting_structure: [], // rendered by the viewer from GET /reporting-structure
};

const st = (res) => ({ loading: res.status === 'loading' && !res.data, error: res.status === 'error' ? res.error : null });

function EmployeeOverview({ d }) {
	const h = d.overview.data && d.overview.data.headcount;
	const segments = h && h.byStatus ? Object.entries(h.byStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) })) : [];
	return (
		<div className="grid grid--2 u-items-start">
			<KpiCard label="Employees" icon="users" {...st(d.overview)} value={h && h.total !== undefined && h.total !== null ? formatNumber(h.total) : null} metric={h} />
			<Card title="By employment status">
				<StateView res={d.overview} loadingHeight={120}>
					{segments.length ? <DonutChart segments={segments} centerLabel="employees" ariaLabel="Employees by status" /> : <EmptyState icon="users" title="No employees in this selection" />}
				</StateView>
			</Card>
		</div>
	);
}

function AttendanceLeave({ d }) {
	const l = d.overview.data && d.overview.data.leave;
	const a = d.overview.data && d.overview.data.attendance;
	return (
		<div className="stack">
			<div className="grid grid--kpi">
				<KpiCard label="Late check-in rate" {...st(d.overview)} value={a && a.lateRatePercent !== undefined && a.lateRatePercent !== null ? `${formatNumber(a.lateRatePercent, 1)}%` : null} metric={a} />
				<KpiCard label="Approved leave" unit="days" {...st(d.overview)} value={l && l.approvedDays !== undefined && l.approvedDays !== null ? formatNumber(l.approvedDays, 1) : null} metric={l} />
			</div>
			<AttendanceTrendCard res={d.trends} />
		</div>
	);
}

function BillableHours({ d }) {
	const t = d.overview.data && d.overview.data.time;
	return (
		<div className="stack">
			<div className="grid grid--kpi">
				<KpiCard label="Billable hours" unit="h" {...st(d.overview)} value={t ? formatNumber(minutesToHours(t.billableMinutes), 1) : null} metric={t} />
				<KpiCard label="Non-billable hours" unit="h" {...st(d.overview)} value={t ? formatNumber(minutesToHours(t.nonBillableMinutes), 1) : null} />
			</div>
			<BillableTrendCard res={d.trends} clamped={d.trendClamped} />
		</div>
	);
}

/** key -> { title, lead, render(data) }. Titles are what the audience sees on the slide. */
export const SECTION_RENDERERS = {
	executive_summary: { title: 'Executive summary', lead: 'Headline numbers for the selected period', render: (d) => (<div className="stack"><KpiRow overview={d.overview} projects={d.projects} /><InsightsCard overview={d.overview} projects={d.projects} product={d.product} freshness={d.freshness} /></div>) },
	employee_overview: { title: 'Employee overview', lead: 'Headcount by employment status', render: (d) => <EmployeeOverview d={d} /> },
	attendance_leave: { title: 'Attendance and leave', lead: 'Late check-ins and approved leave', render: (d) => <AttendanceLeave d={d} /> },
	project_performance: { title: 'Project performance', lead: 'Status mix, workload and burn against estimates', render: (d) => <ProjectHealthCard res={d.projects} /> },
	billable_hours: { title: 'Billable hours', lead: 'Approved billable and non-billable time', render: (d) => <BillableHours d={d} /> },
	product_development: { title: 'Product development', lead: 'Work items by status', render: (d) => <ProductStatusCard res={d.product} /> },
	ai_usage: { title: 'AI usage', lead: 'Reported tool usage', render: (d) => <AiUsageCard res={d.ai} /> },
	key_insights: { title: 'Key insights', lead: 'What stands out in the data', render: (d) => <InsightsCard overview={d.overview} projects={d.projects} product={d.product} freshness={d.freshness} /> },
};

/** Union of datasets needed by a deck's section slides. */
export const sectionsNeeded = (slides) => [...new Set(slides.filter((s) => s.type === 'section').flatMap((s) => SECTION_NEEDS[s.section] || []).concat(['freshness'], widgetSections(slides)))];
