import React, { useCallback, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Modal from '../../components/common/Modal';
import FilterBar from '../../components/filters/FilterBar';
import ProjectFilter from '../../components/filters/ProjectFilter';
import TeamFilter from '../../components/filters/TeamFilter';
import useDashboardFilters from '../../hooks/useDashboardFilters';
import useBentoReveal from '../../hooks/useBentoReveal';
import useDashboardLayout from '../../hooks/useDashboardLayout';
import useOutsideClick from '../../hooks/useOutsideClick';
import { resolvePeriod } from '../../utils/periods';
import DashboardLayoutEditor from './DashboardLayoutEditor';
import { EntranceContext, useDashboardEntrance } from './entrance';
import CustomRange from './CustomRange';
import ScopeTimeline, { MONTH_NAMES, fmtDay, monthRange } from './ScopeTimeline';
import { AttentionCard, BillableCard, SidePanel, WorkloadCard } from './signature/Signature';
import useDashboardData from './useDashboardData';
import AiUsageCard from './widgets/AiUsageCard';
import InsightsCard from './widgets/InsightsCard';
import KpiRow from './widgets/KpiRow';
import ProductStatusCard from './widgets/ProductStatusCard';
import ProjectHealthCard from './widgets/ProjectHealthCard';
import PeopleLeaveCard from './widgets/PeopleLeaveCard';
import TimeBreakdownCard from './widgets/TimeBreakdownCard';
import { AttendanceTrendCard } from './widgets/TrendCards';

// Widgets that use the full row (their content is laid out in columns); the others share a row in pairs.
const MODES = [
	{ id: 'month', label: 'Month' },
	{ id: 'custom', label: 'Custom' },
];
const isWholeMonth = ({ from, to }) => Boolean(from && to) && from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01') && to === monthRange(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1).to;
const WIDE = ['time-breakdown', 'people-leave', 'project-health', 'ai-usage', 'insights'];

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
	useBentoReveal('.dash', [f.valid]);
	const entrance = useDashboardEntrance(); // 'cinematic' on the first visit of a session, else 'quick'
	const reset = () => f.update({ period: { preset: 'this_month' }, team: '', project: '' });
	const setPreset = (preset) => f.update({ period: { preset } });
	const resolved = resolvePeriod(f.period);
	// Month picks one calendar month; Custom builds any range. A range that is not a whole month opens as Custom.
	const [mode, setMode] = useState(() => (f.period.preset === 'custom' || f.period.preset === 'last_30_days' || f.period.preset === 'this_quarter') && !isWholeMonth(resolved) ? 'custom' : 'month');
	const [chipsHost, setChipsHost] = useState(null);
	const [year, setYear] = useState(() => Number((resolved.to || resolved.from || '2000').slice(0, 4)));
	// The month strip / calendar float over the page in a popover, so choosing dates never moves the dashboard.
	const [open, setOpen] = useState(false);
	const bar = useRef(null);
	const closePop = useCallback(() => setOpen(false), []);
	useOutsideClick(bar, closePop, open);
	const chooseMode = (id) => {
		setMode(id);
		if (id === 'month' && !isWholeMonth(resolved)) setPreset('this_month');
		setOpen(id === 'custom'); // Custom starts straight on the calendar
	};
	const pickMonth = (m) => {
		const r = monthRange(year, m);
		const now = resolvePeriod({ preset: 'this_month' });
		f.update({ period: r.from === now.from && r.to === now.to ? { preset: 'this_month' } : { preset: 'custom', ...r } });
		setOpen(false);
	};
	const whenLabel = resolved.from && resolved.to ? (isWholeMonth(resolved) ? `${MONTH_NAMES[Number(resolved.to.slice(5, 7)) - 1]} ${resolved.to.slice(0, 4)}` : `${fmtDay(resolved.from)} → ${fmtDay(resolved.to)}`) : 'Choose dates';
	const activeCount = (f.period.preset !== 'this_month' ? 1 : 0) + (f.team ? 1 : 0) + (f.project ? 1 : 0);

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
					</div>
					<FilterBar label="Dashboard filters">
						<div className={`ofilter ${activeCount ? 'is-filtered' : ''}`.trim()} ref={bar}>
							<div className="ofilter__row">
								<div className="ofilter__lead">
									<span className="ofilter__eyebrow">
										<Icon name="filter" size={14} /> Viewing
									</span>
									<div className="oseg" role="group" aria-label="Period type" style={{ '--n': MODES.length, '--i': MODES.findIndex((m) => m.id === mode) }}>
										<span className="oseg__thumb" aria-hidden="true" />
										{MODES.map((m) => (
											<button key={m.id} type="button" className="oseg__btn" aria-pressed={mode === m.id} onClick={() => chooseMode(m.id)}>
												{m.label}
											</button>
										))}
									</div>
									{mode === 'month' ? (
										<button type="button" className="ofilter__when" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
											<Icon name="calendar" size={14} />
											<span>{whenLabel}</span>
											<Icon name="chevronDown" size={14} className="ofilter__caret" />
										</button>
									) : (
										<div className="ofilter__chips" ref={setChipsHost} />
									)}
									{activeCount ? (
										<span className="ofilter__count" role="status">
											{activeCount} changed
										</span>
									) : null}
								</div>
								<div className="ofilter__side">
									<div className="ofilter__sentence">
										<span className="ofilter__word" aria-hidden="true">
											for
										</span>
										<span className={`ofilter__slot ${f.team ? 'is-set' : ''}`.trim()}>
											<TeamFilter value={f.team} onChange={(team) => f.update({ team })} />
										</span>
										<span className="ofilter__word" aria-hidden="true">
											on
										</span>
										<span className={`ofilter__slot ${f.project ? 'is-set' : ''}`.trim()}>
											<ProjectFilter value={f.project} onChange={(project) => f.update({ project })} />
										</span>
									</div>
									<Button
										variant="ghost"
										icon="refresh"
										onClick={() => {
											reset();
											setOpen(false);
										}}
										disabled={activeCount === 0}
									>
										Reset
									</Button>
								</div>
							</div>
							{mode === 'month' ? (
								 open ? (
									<div className="ofilter__pop" role="dialog" aria-label="Choose a month">
										<ScopeTimeline from={resolved.from} to={resolved.to} year={year} onYear={setYear} onPick={pickMonth} />
									</div>
								) : null
							) : (
								<CustomRange
									from={f.period.preset === 'custom' ? f.period.from : undefined}
									to={f.period.preset === 'custom' ? f.period.to : undefined}
									onCommit={({ from, to }) => f.update({ period: { preset: 'custom', from, to } })}
									chipsHost={chipsHost}
									open={open}
									onOpenChange={setOpen}
								/>
							)}
						</div>
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
