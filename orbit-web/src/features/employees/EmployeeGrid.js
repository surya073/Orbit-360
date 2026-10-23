import React from 'react';
import Icon from '../../components/common/Icon';
import { formatDate } from '../../utils/dates';
import { EMPTY, humanize } from '../../utils/format';
import { initials, tenure } from './employeeFacts';

/**
 * One employee as a directory profile card: status and code on top, a large avatar, who they are, a few chips and
 * the row actions along the bottom (the first one, View profile, spans the card). Every line is real
 * data from the record; a missing value is simply left out rather than invented.
 */
export default function EmployeeGridCard({ row, labelOf, actions }) {
	const team = labelOf('primary_team_id', row.primary_team_id);
	const status = row.employment_status || 'unknown';
	const joined = row.joining_date ? formatDate(row.joining_date) : null;
	const served = tenure(row.joining_date);
	const email = row.email_normalized;
	return (
		<article className="hcard" data-status={status} aria-label={row.full_name || 'Employee'}>
			<header className="hcard__head">
				<span className="hcard__pill">{humanize(status)}</span>
				<span className="hcard__code">{row.employee_code || EMPTY}</span>
			</header>
			<span className="hcard__avatar" aria-hidden="true">
				{initials(row.full_name)}
			</span>
			<h3 className="hcard__name">{row.full_name || 'Unnamed employee'}</h3>
			<p className="hcard__role">{row.job_role || 'No role recorded'}</p>
			<p className="hcard__team">
				<Icon name="team" size={14} /> {team || 'No team'}
			</p>
			<ul className="hcard__chips" aria-label="Details">
				{joined ? (
					<li className="hcard__chip">
						<Icon name="calendar" size={12} /> {joined}
					</li>
				) : null}
				{served ? <li className="hcard__chip">{served.replace(' with us', '')}</li> : null}
				{email ? (
					<li>
						<a className="hcard__chip" href={`mailto:${email}`}>
							<Icon name="bell" size={12} /> Email
						</a>
					</li>
				) : null}
			</ul>
			{actions ? <div className="hcard__actions">{actions}</div> : null}
		</article>
	);
}
