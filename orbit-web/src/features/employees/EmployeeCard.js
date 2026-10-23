import React from 'react';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/dates';
import { EMPTY } from '../../utils/format';
import { initials, tenure } from './employeeFacts';

/** One employee as a card: who they are, where they sit, how to reach them. Read-only; Edit opens the form. */
export default function EmployeeCard({ row, labelOf, canEdit, onEdit, onClose }) {
	const team = labelOf('primary_team_id', row.primary_team_id);
	const email = row.email_normalized;
	const facts = [
		{ icon: 'user', label: 'Employee code', value: row.employee_code },
		{ icon: 'team', label: 'Team', value: team },
		{ icon: 'calendar', label: 'Joined', value: row.joining_date ? formatDate(row.joining_date) : null, note: tenure(row.joining_date) },
	];
	return (
		<Modal
			title="Employee"
			onClose={onClose}
			footer={
				<>
					<Button onClick={onClose}>Close</Button>
					{canEdit ? (
						<Button variant="primary" icon="edit" onClick={onEdit}>
							Edit
						</Button>
					) : null}
				</>
			}
		>
			<article className="ecard" aria-label={`${row.full_name || 'Employee'} details`}>
				<header className="ecard__hero">
					<span className="ecard__avatar" aria-hidden="true">
						{initials(row.full_name)}
					</span>
					<div className="ecard__who">
						<h3>{row.full_name || 'Unnamed employee'}</h3>
						<p>{row.job_role || 'No role recorded'}</p>
					</div>
					<StatusBadge status={row.employment_status} />
				</header>
				<dl className="ecard__facts">
					{facts.map((f) => (
						<div key={f.label} className="ecard__fact">
							<dt>
								<Icon name={f.icon} size={14} /> {f.label}
							</dt>
							<dd>
								{f.value || EMPTY}
								{f.note ? <small>{f.note}</small> : null}
							</dd>
						</div>
					))}
					<div className="ecard__fact ecard__fact--wide">
						<dt>
							<Icon name="bell" size={14} /> Email
						</dt>
						<dd>{email ? <a href={`mailto:${email}`}>{email}</a> : EMPTY}</dd>
					</div>
				</dl>
			</article>
		</Modal>
	);
}
