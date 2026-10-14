import React from 'react';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import BarList from '../../../components/charts/BarList';
import DonutChart from '../../../components/charts/DonutChart';
import { colorAt } from '../../../components/charts/scale';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { formatNumber, humanize, minutesToHours } from '../../../utils/format';

/**
 * Project mix and workload. "Burn" is lifetime approved hours versus the project's estimate;
 * it is shown only when an estimate exists, and over-estimate is called out as a fact.
 */
export default function ProjectHealthCard({ res }) {
	const d = res.data;
	const segments = d ? Object.entries(d.status.byStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) })) : [];
	const wl = d && d.workload;
	return (
		<Card title="Project health and workload" subtitle="Status mix, and approved hours per project in the period" actions={d ? <CompletenessBadge metric={wl} /> : null}>
			<StateView res={res} loadingHeight={220}>
				{d && d.status.total === null && wl.projects.length === 0 ? (
					<EmptyState icon="folder" title="No projects in this selection" message="Import or add projects to see their status and workload." />
				) : d ? (
					<div className="grid grid--2" style={{ alignItems: 'start' }}>
						<div>
							<h3 className="small muted" style={{ marginBottom: 8, fontWeight: 600 }}>Projects by status</h3>
							{segments.length ? <DonutChart segments={segments} centerLabel="projects" ariaLabel="Projects by status" /> : <p className="muted small">No project statuses recorded.</p>}
						</div>
						<div>
							<h3 className="small muted" style={{ marginBottom: 8, fontWeight: 600 }}>Busiest projects (approved hours)</h3>
							{wl.projects.length ? (
								<BarList
									ariaLabel="Approved hours by project"
									items={wl.projects.map((p) => ({
										id: p.projectId,
										label: p.name || `Project #${p.projectId}`,
										value: minutesToHours(p.periodMinutes),
										display: `${formatNumber(minutesToHours(p.periodMinutes), 1)}h`,
										note: p.burnPercent === null ? '· no estimate' : p.burnPercent > 100 ? `· ${formatNumber(p.burnPercent, 0)}% of estimate (over)` : `· ${formatNumber(p.burnPercent, 0)}% of estimate`,
										color: p.burnPercent !== null && p.burnPercent > 100 ? 'var(--chart-5)' : 'var(--chart-1)',
									}))}
								/>
							) : (
								<p className="muted small">No approved time logged against projects in this period.</p>
							)}
							{wl.projectsWithTime > wl.projects.length ? <p className="small muted" style={{ marginTop: 8 }}>Showing the top {wl.projects.length} of {wl.projectsWithTime} projects with time.</p> : null}
						</div>
					</div>
				) : null}
			</StateView>
		</Card>
	);
}
