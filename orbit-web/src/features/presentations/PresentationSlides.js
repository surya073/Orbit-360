import React, { useRef } from 'react';
import logo from '../../assets/images/logo.svg';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import ToolLogo from '../../components/common/ToolLogo';
import { formatDate } from '../../utils/dates';
import { EMPTY, formatNumber, humanize, metricNote } from '../../utils/format';
import { initials, statusTone, tenureText } from './deckSlides';
import useFitToSlide from './useFitToSlide';

/** Common slide layout: kicker, title, lead and a body that scrolls (never clips) if content is tall. */
export function SlideFrame({ kicker, title, lead, children, className = '' }) {
	const bodyRef = useRef(null);
	useFitToSlide(bodyRef);
	return (
		<div className={`pframe ${className}`.trim()}>
			<header className="pframe__head">
				{kicker ? <span className="pframe__kicker">{kicker}</span> : null}
				<h1 className="pframe__title">{title}</h1>
				{lead ? <p className="pframe__lead">{lead}</p> : null}
			</header>
			<div className="pframe__body" ref={bodyRef}>
				{children}
			</div>
		</div>
	);
}

export function Brand({ size = 28 }) {
	return (
		<span className="pbrand">
			<img src={logo} alt="" width={size} height={size} />
			<span>Orbit 360</span>
		</span>
	);
}

const Pill = ({ tone = 'neutral', children }) => <span className={`ppill ppill--${tone}`}>{children}</span>;

/** Long titles step down in size instead of being cut off. */
const titleSize = (t) => (String(t).length > 110 ? 'pcover__title--xl' : String(t).length > 55 ? 'pcover__title--lg' : '');

export function OpeningSlide({ title, periodText, rangeText, dateText }) {
	return (
		<div className="pcover">
			<div className="pcover__orbs" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<Brand size={44} />
			<div className="pcover__main">
				<span className="pframe__kicker">Executive briefing</span>
				<h1 className={`pcover__title ${titleSize(title)}`.trim()}>{title}</h1>
				<p className="pcover__sub">
					{periodText}
					{rangeText ? <span> · {rangeText}</span> : null}
				</p>
			</div>
			<div className="pcover__meta">
				<span>
					<Icon name="calendar" size={20} /> Presented {dateText}
				</span>
				<span>
					<Icon name="lock" size={20} /> Live data, shown within your access
				</span>
			</div>
		</div>
	);
}

export function ClosingSlide({ title, periodText, rangeText, generatedText }) {
	return (
		<div className="pcover pcover--closing">
			<div className="pcover__orbs" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			<Brand size={44} />
			<div className="pcover__main">
				<span className="pframe__kicker">{title}</span>
				<h1 className="pcover__title">Thank you</h1>
				<p className="pcover__sub">Questions and discussion</p>
			</div>
			<div className="pcover__meta">
				<span>
					<Icon name="calendar" size={20} /> {periodText}
					{rangeText ? ` · ${rangeText}` : ''}
				</span>
				<span>
					<Icon name="clock" size={20} /> Prepared from live Orbit 360 data on {generatedText}
				</span>
			</div>
		</div>
	);
}

export function TextSlide({ title, body }) {
	return (
		<SlideFrame kicker="Notes" title={title || 'Slide'}>
			<p className="ptext">{body}</p>
		</SlideFrame>
	);
}

const teamName = (labelOf, id) => (id ? labelOf('primary_team_id', id) : null);

/** Grid of people cards: avatar (initials only: no photos exist), name, role, team, status. */
export function PeopleSlide({ slide, labelOf }) {
	const { rows, part, parts, total, shown } = slide;
	return (
		<SlideFrame kicker="People" title={parts > 1 ? `Team overview (${part} of ${parts})` : 'Team overview'} lead={total > shown ? `Showing ${shown} of ${formatNumber(total)} people, in name order` : `${formatNumber(total)} ${total === 1 ? 'person' : 'people'}, in name order`}>
			<ul className="ppeople">
				{rows.map((p) => (
					<li key={p.ROWID} className="pperson">
						<span className="pperson__avatar" aria-hidden="true">
							{initials(p.full_name)}
						</span>
						<div className="pperson__text">
							<h2>{p.full_name}</h2>
							<p>{p.job_role || 'Role not recorded'}</p>
							<p className="pperson__team">{teamName(labelOf, p.primary_team_id) || 'No team recorded'}</p>
						</div>
						{p.employment_status ? <Pill tone={statusTone(p.employment_status)}>{humanize(p.employment_status)}</Pill> : null}
					</li>
				))}
			</ul>
		</SlideFrame>
	);
}

function Fact({ label, value, note }) {
	const missing = value === null || value === undefined || value === '';
	return (
		<div className="pfact">
			<dt>{label}</dt>
			<dd className={missing ? 'is-missing' : ''}>
				{missing ? EMPTY : value}
				{!missing && note ? <small>{note}</small> : null}
			</dd>
		</div>
	);
}

const hoursText = (min) => (min === null || min === undefined ? null : `${formatNumber(min / 60, 1)} h`);
const noData = (metric) => !metric || metric.completeness === 'insufficient_data' || metric.completeness === 'not_applicable';

/** One activity panel of a profile slide: a heading, the figures, and the data-quality note when a figure is partial. */
function ActivityPanel({ icon, title, state, metric, children, empty = 'No records in this period' }) {
	let body;
	if (state === 'loading') body = <p className="pact__state">Loading…</p>;
	else if (state === 'error') body = <p className="pact__state">Could not be loaded</p>;
	else if (metric !== undefined && noData(metric)) body = <p className="pact__state">{empty}</p>;
	else body = children;
	const note = state === 'ready' && metric && metric.completeness === 'partial' ? metricNote(metric) : null;
	return (
		<section className="pact">
			<h3 className="pact__title">
				<Icon name={icon} size={22} /> {title}
			</h3>
			{body}
			{note ? <p className="pact__note">{note}</p> : null}
		</section>
	);
}

const Stat = ({ label, value, strong }) => (
	<div className={`pstat ${strong ? 'pstat--strong' : ''}`.trim()}>
		<span className="pstat__label">{label}</span>
		<b className="pstat__value">{value}</b>
	</div>
);

/** Everything known about one person for the period, from backend-computed metrics (missing = not recorded, never 0). */
function ProfileActivity({ activity }) {
	const state = activity.status;
	const d = activity.data || {};
	const time = d.time;
	const att = d.attendance;
	const leave = d.leave;
	const ai = d.ai;
	const product = d.product;
	const projects = d.projects;
	const leaveStatuses = leave && leave.byStatus ? Object.entries(leave.byStatus) : [];
	const types = product && product.byType ? Object.entries(product.byType).map(([t, s]) => [t, Object.values(s || {}).reduce((a, b) => a + b, 0)]) : [];
	return (
		<div className="pactivity">
			<ActivityPanel icon="clock" title="Approved time" state={state} metric={time}>
				{time ? (
					<>
						<Stat strong label="Total" value={hoursText(time.totalMinutes) || EMPTY} />
						<Stat label="Billable" value={`${hoursText(time.billableMinutes) || EMPTY}${time.billablePercent === null || time.billablePercent === undefined ? '' : ` · ${formatNumber(time.billablePercent, 0)}%`}`} />
						<Stat label="Non-billable" value={hoursText(time.nonBillableMinutes) || EMPTY} />
						{time.billablePercent !== null && time.billablePercent !== undefined ? (
							<div className="pbar" aria-hidden="true">
								<i style={{ width: `${Math.min(Math.max(time.billablePercent, 0), 100)}%` }} />
							</div>
						) : null}
					</>
				) : null}
			</ActivityPanel>
			<ActivityPanel icon="alert" title="Check-ins" state={state} metric={att}>
				{att ? (
					<>
						<Stat strong label="Late check-ins" value={att.lateCount === null ? EMPTY : `${att.lateCount} of ${att.records}`} />
						<Stat label="On time" value={att.onTimeCount === null ? EMPTY : att.onTimeCount} />
						<Stat label="Late rate" value={att.lateRatePercent === null ? EMPTY : `${formatNumber(att.lateRatePercent, 0)}%`} />
					</>
				) : null}
			</ActivityPanel>
			<ActivityPanel icon="calendar" title="Leave" state={state} metric={leave}>
				{leave ? (
					<>
						<Stat strong label="Approved days" value={leave.approvedDays === null ? EMPTY : formatNumber(leave.approvedDays, 1)} />
						{leave.approvedHours ? <Stat label="Approved hours" value={formatNumber(leave.approvedHours, 1)} /> : null}
						<p className="pact__chips">{leaveStatuses.map(([s, n]) => `${humanize(s)} ${n}`).join(' · ')}</p>
					</>
				) : null}
			</ActivityPanel>
			<ActivityPanel icon="sparkles" title="AI tool usage" state={state} metric={ai} empty="No usage reported">
				{ai ? (
					<ul className="ptools">
						{(ai.tools || []).slice(0, 4).map((t) => (
							<li key={`${t.tool}-${t.category}`}>
								<ToolLogo name={t.tool} size={34} />
								<span className="ptools__name">{t.tool}</span>
								<span className="ptools__n">{t.avgReportedPercent === null ? `${t.records} rec.` : `${formatNumber(t.avgReportedPercent, 0)}%`}</span>
							</li>
						))}
						{(ai.tools || []).length > 4 ? <li className="ptools__more">+{ai.tools.length - 4} more tools</li> : null}
					</ul>
				) : null}
			</ActivityPanel>
			<ActivityPanel icon="box" title="Product development" state={state} metric={product} empty="No items assigned">
				{product ? (
					<>
						<Stat strong label="Items assigned" value={product.total} />
						<p className="pact__chips">{Object.entries(product.byStatus || {}).map(([s, n]) => `${humanize(s)} ${n}`).join(' · ')}</p>
						<p className="pact__chips">{types.map(([t, n]) => `${humanize(t)} ${n}`).join(' · ')}</p>
					</>
				) : null}
			</ActivityPanel>
			<ActivityPanel icon="folder" title="Projects contributed" state={state} metric={projects && projects.total ? projects : { completeness: 'insufficient_data' }} empty="No approved time on projects">
				{projects ? (
					<ul className="pprojects">
						{(projects.items || []).map((p) => (
							<li key={p.projectId}>
								<span className="pprojects__name">{p.name || `Project ${p.projectId}`}</span>
								<b>{hoursText(p.periodMinutes)}</b>
							</li>
						))}
						{projects.total > (projects.items || []).length ? <li className="ptools__more">+{projects.total - (projects.items || []).length} more projects</li> : null}
					</ul>
				) : null}
			</ActivityPanel>
		</div>
	);
}

/** One person: identity on the left, their activity for the deck period on the right. Fields that were not recorded read as a dash. */
export function ProfileSlide({ slide, labelOf }) {
	const { person: p, n, of, total, activity } = slide;
	const tenure = tenureText(p.joining_date);
	return (
		<SlideFrame kicker={`Profile ${n} of ${of}`} title={p.full_name} lead={p.job_role || 'Role not recorded'} className="pframe--profile">
			<div className="pprofile">
				<div className="pprofile__id">
					<span className="pprofile__avatar" aria-hidden="true">
						{initials(p.full_name)}
					</span>
					{p.employment_status ? <Pill tone={statusTone(p.employment_status)}>{humanize(p.employment_status)}</Pill> : null}
					<dl className="pprofile__facts">
						<Fact label="Team" value={teamName(labelOf, p.primary_team_id)} />
						<Fact label="Reports to" value={p.reports_to_employee_id ? labelOf('reports_to_employee_id', p.reports_to_employee_id) : null} />
						<Fact label="Employee code" value={p.employee_code} />
						<Fact label="Joined" value={p.joining_date ? formatDate(p.joining_date) : null} note={tenure ? `${tenure} (calculated)` : null} />
					</dl>
					<p className="pprofile__note">{total > of ? `One of the first ${of} of ${formatNumber(total)} people, in name order` : `${of} ${of === 1 ? 'person' : 'people'} in this selection`}</p>
				</div>
				<ProfileActivity activity={activity || { status: 'loading' }} />
			</div>
		</SlideFrame>
	);
}

/** Project records table. Every value comes from the project record; empty ones show a dash. */
export function RecordsSlide({ slide, labelOf }) {
	const { rows, part, parts, total, shown } = slide;
	return (
		<SlideFrame kicker="Records" title={parts > 1 ? `Project records (${part} of ${parts})` : 'Project records'} lead={total > shown ? `Showing ${shown} of ${formatNumber(total)} projects, in name order` : `${formatNumber(total)} ${total === 1 ? 'project' : 'projects'}, in name order`}>
			<table className="ptable">
				<thead>
					<tr>
						<th scope="col">Project</th>
						<th scope="col">Team</th>
						<th scope="col">Status</th>
						<th scope="col">Type</th>
						<th scope="col">Start</th>
						<th scope="col">End</th>
						<th scope="col" className="num">
							Est. hours
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.ROWID}>
							<th scope="row">
								<span className="ptable__name">{r.project_name}</span>
								{r.project_code ? <small>{r.project_code}</small> : null}
							</th>
							<td>{r.team_id ? labelOf('team_id', r.team_id) : EMPTY}</td>
							<td>{r.current_status ? <Pill tone={statusTone(r.current_status)}>{humanize(r.current_status)}</Pill> : EMPTY}</td>
							<td>{r.project_type || EMPTY}</td>
							<td>{r.first_start_date ? formatDate(r.first_start_date) : EMPTY}</td>
							<td>{r.end_date ? formatDate(r.end_date) : EMPTY}</td>
							<td className="num">{r.estimated_hours !== null && r.estimated_hours !== undefined && r.estimated_hours !== '' ? formatNumber(Number(r.estimated_hours), 1) : EMPTY}</td>
						</tr>
					))}
				</tbody>
			</table>
		</SlideFrame>
	);
}

const TOPIC = { people: { kicker: 'People', title: 'Team overview', noun: 'people' }, projects: { kicker: 'Records', title: 'Project records', noun: 'projects' } };

/** Stand-in while detail data loads, or when it failed/is empty: never a made-up slide. */
export function DetailStateSlide({ slide, onRetry }) {
	const t = TOPIC[slide.topic];
	return (
		<SlideFrame kicker={t.kicker} title={t.title}>
			{slide.state === 'loading' ? (
				<p className="pstate" role="status">
					Loading {t.noun}…
				</p>
			) : slide.state === 'error' ? (
				<div className="pstate" role="alert">
					<p>The {t.noun} could not be loaded{slide.error && slide.error.message ? `: ${slide.error.message}` : '.'}</p>
					{onRetry ? (
						<Button variant="primary" onClick={onRetry}>
							Retry
						</Button>
					) : null}
				</div>
			) : (
				<p className="pstate">There are no {t.noun} in this selection.</p>
			)}
		</SlideFrame>
	);
}
