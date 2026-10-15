import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/cards/Card';
import CompletenessBadge from '../../../components/cards/CompletenessBadge';
import DonutChart from '../../../components/charts/DonutChart';
import ProgressBar from '../../../components/charts/ProgressBar';
import { colorAt } from '../../../components/charts/scale';
import StatusBadge from '../../../components/common/StatusBadge';
import EmptyState from '../../../components/feedback/EmptyState';
import StateView from '../../../components/feedback/StateView';
import { ROUTES } from '../../../config/routes';
import { formatNumber, humanize, minutesToHours } from '../../../utils/format';

const BURN_MAX = 150; // the bar scale: 100% is the estimate, the rest leaves room to show an over-run

/**
 * Project mix and workload. "Burn" is lifetime approved hours versus the project's estimate;
 * it is shown only when an estimate exists, and over-estimate is called out as a fact.
 */
export default function ProjectHealthCard({ res, drill = false }) {
	const d = res.data;
	const segments = d ? Object.entries(d.status.byStatus).map(([k, v], i) => ({ label: humanize(k), value: v, color: colorAt(i) })) : [];
	const wl = d && d.workload;
	const over = wl ? wl.projects.filter((p) => p.burnPercent !== null && p.burnPercent > 100).length : 0;
	const noEstimate = wl ? wl.projects.filter((p) => p.estimatedHours === null).length : 0;
	return (
		<Card icon="folder" accent="var(--chart-4)" title="Project health and workload" subtitle="Status mix, and approved hours per project in the period" actions={d ? <CompletenessBadge metric={wl} /> : null}>
			<StateView res={res} loadingHeight={220}>
				{d && d.status.total === null && wl.projects.length === 0 ? (
					<EmptyState icon="folder" title="No projects in this selection" message="Import or add projects to see their status and workload." />
				) : d ? (
					<div className="ph">
						<div>
							<h3 className="block__title">Projects by status</h3>
							{segments.length ? <DonutChart segments={segments} centerLabel="projects" ariaLabel="Projects by status" /> : <p className="muted small">No project statuses recorded.</p>}
							{wl.projects.length ? (
								<div className="callouts">
									<span className={`callout ${over ? 'callout--warn' : 'callout--ok'}`}>{over ? `${over} of ${wl.projects.length} shown over estimate` : 'None of those shown over estimate'}</span>
									{noEstimate ? <span className="callout">{noEstimate} of those shown without an estimate</span> : null}
								</div>
							) : null}
						</div>
						<div>
							<h3 className="block__title">Busiest projects (approved hours)</h3>
							{wl.projects.length ? (
								<ul className="projlist" aria-label="Approved hours by project">
									{wl.projects.map((p, i) => {
										const hours = minutesToHours(p.periodMinutes);
										const burn = p.burnPercent;
										const overRun = burn !== null && burn > 100;
										return (
											<li key={p.projectId} className="projlist__row">
												<div className="projlist__head">
													{drill ? (
														<Link className="projlist__name" to={`${ROUTES.projects}?q=${encodeURIComponent(p.name || '')}`} title={p.name || `Project #${p.projectId}`}>
															{p.name || `Project #${p.projectId}`}
														</Link>
													) : (
														<span className="projlist__name" title={p.name || `Project #${p.projectId}`}>
															{p.name || `Project #${p.projectId}`}
														</span>
													)}
													{p.status ? <StatusBadge status={p.status} /> : null}
													<b className="num projlist__hours">{formatNumber(hours, 1)}h</b>
												</div>
												<div className="projlist__bar">
													<ProgressBar value={burn === null ? null : burn} max={BURN_MAX} marker={100} color={overRun ? 'var(--chart-5)' : colorAt(i)} />
													<span className="small muted projlist__burn">{burn === null ? 'No estimate recorded' : `${formatNumber(burn, 0)}% of ${formatNumber(p.estimatedHours, 0)}h estimate${overRun ? ' (over)' : ''}`}</span>
												</div>
												<div className="small muted">
													{formatNumber(p.entries)} approved {p.entries === 1 ? 'entry' : 'entries'} this period
													{p.lifetimeMinutes !== null ? ` · ${formatNumber(minutesToHours(p.lifetimeMinutes), 1)}h lifetime` : ''}
												</div>
											</li>
										);
									})}
								</ul>
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
