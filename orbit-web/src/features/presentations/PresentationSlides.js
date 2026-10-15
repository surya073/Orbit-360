import React from 'react';
import logo from '../../assets/images/logo.svg';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { formatDate } from '../../utils/dates';
import { EMPTY, formatNumber, humanize } from '../../utils/format';
import { initials, statusTone, tenureText } from './deckSlides';

/** Common slide layout: kicker, title, lead and a body that scrolls (never clips) if content is tall. */
export function SlideFrame({ kicker, title, lead, children, className = '' }) {
	return (
		<div className={`pframe ${className}`.trim()}>
			<header className="pframe__head">
				{kicker ? <span className="pframe__kicker">{kicker}</span> : null}
				<h1 className="pframe__title">{title}</h1>
				{lead ? <p className="pframe__lead">{lead}</p> : null}
			</header>
			<div className="pframe__body">{children}</div>
		</div>
	);
}

export function Brand({ size = 28 }) {
	return (
		<span className="pbrand">
			<img src={logo} alt="" width={size} height={size} />
			<span>Company 360</span>
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
					<Icon name="clock" size={20} /> Prepared from live Company 360 data on {generatedText}
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

/** One person, editorial layout. Only fields that exist are shown as values; the rest read as not recorded. */
export function ProfileSlide({ slide, labelOf }) {
	const { person: p, n, of, total } = slide;
	const tenure = tenureText(p.joining_date);
	return (
		<SlideFrame kicker={`Profile ${n} of ${of}`} title={p.full_name} lead={p.job_role || 'Role not recorded'} className="pframe--profile">
			<div className="pprofile">
				<div className="pprofile__id">
					<span className="pprofile__avatar" aria-hidden="true">
						{initials(p.full_name)}
					</span>
					{p.employment_status ? <Pill tone={statusTone(p.employment_status)}>{humanize(p.employment_status)}</Pill> : null}
					<p className="pprofile__note">{total > of ? `One of the first ${of} of ${formatNumber(total)} people, in name order` : `${of} ${of === 1 ? 'person' : 'people'} in this selection`}</p>
				</div>
				<dl className="pprofile__facts">
					<Fact label="Team" value={teamName(labelOf, p.primary_team_id)} />
					<Fact label="Reports to" value={p.reports_to_employee_id ? labelOf('reports_to_employee_id', p.reports_to_employee_id) : null} />
					<Fact label="Employee code" value={p.employee_code} />
					<Fact label="Joined" value={p.joining_date ? formatDate(p.joining_date) : null} note={tenure ? `${tenure} (calculated)` : null} />
				</dl>
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
