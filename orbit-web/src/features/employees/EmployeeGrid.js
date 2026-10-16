import React from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/dates';
import { EMPTY } from '../../utils/format';

const initials = (name) =>
	String(name || '?')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('');

/** One employee as a directory card: who, where they sit, the facts people look up, and the row actions. */
export default function EmployeeGridCard({ row, labelOf, actions }) {
	const team = labelOf('primary_team_id', row.primary_team_id);
	const facts = [
		['Code', row.employee_code],
		['Joined', row.joining_date ? formatDate(row.joining_date) : null],
	];
	return (
		<article className="hcard" aria-label={row.full_name || 'Employee'}>
			<div className="hcard__top">
				<span className="hcard__avatar" aria-hidden="true">
					{initials(row.full_name)}
					<i className={`hcard__dot hcard__dot--${row.employment_status || 'unknown'}`} />
				</span>
				<div className="hcard__who">
					<h3>{row.full_name || 'Unnamed employee'}</h3>
					<p>{row.job_role || 'No role recorded'}</p>
					<small>{team || 'No team'}</small>
				</div>
				<StatusBadge status={row.employment_status} />
			</div>
			<dl className="hcard__facts">
				{facts.map(([label, value]) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{value || EMPTY}</dd>
					</div>
				))}
				<div className="hcard__wide">
					<dt>Mail</dt>
					<dd>{row.email_normalized ? <a href={`mailto:${row.email_normalized}`}>{row.email_normalized}</a> : EMPTY}</dd>
				</div>
			</dl>
			{actions ? <div className="hcard__actions">{actions}</div> : null}
		</article>
	);
}
