import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/feedback/ToastProvider';
import Field from '../../components/forms/Field';
import Select from '../../components/forms/Select';
import { accessService } from '../../services/accessService';
import { SCOPE_LABEL } from './RolesTab';

/**
 * Invite a person: name, email and role (chosen before the invitation is sent). Catalyst emails them a link to set
 * their password; their role and team are already in place when they first sign in.
 */
export default function InviteModal({ roles, teams, canPickTeam, ownTeamId, onClose, onInvited }) {
	const { notify } = useToast();
	const usable = roles.filter((r) => r.isActive);
	const [form, setForm] = useState({ firstName: '', lastName: '', email: '', roleKey: usable.length ? (usable.find((r) => r.key === 'manager') || usable[0]).key : '', teamId: ownTeamId || '' });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [fieldErrors, setFieldErrors] = useState({});
	const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
	const role = usable.find((r) => r.key === form.roleKey);
	const needsTeam = Boolean(role) && role.scopeType === 'own_team';

	const submit = async (e) => {
		e.preventDefault();
		const errs = {};
		if (!form.firstName.trim()) errs.firstName = 'Enter a first name';
		if (!form.lastName.trim()) errs.lastName = 'Enter a last name';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
		if (!role) errs.roleId = 'Choose a role';
		if (needsTeam && !form.teamId) errs.teamId = 'Choose a team: this role works with one team';
		setFieldErrors(errs);
		if (Object.keys(errs).length) return;
		setSaving(true);
		setError('');
		try {
			await accessService.invite({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), roleId: role.id || role.key, ...(form.teamId && (needsTeam || canPickTeam) ? { teamId: form.teamId } : {}) });
			notify(`Invitation sent to ${form.email.trim()}`, 'success');
			onInvited();
		} catch (err) {
			setFieldErrors(err.fieldErrors || {});
			setError(err.message);
			setSaving(false);
		}
	};

	return (
		<Modal
			title="Invite a user"
			onClose={onClose}
			dismissible={!saving}
			footer={
				<>
					<Button onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" form="invite-form" loading={saving}>
						Send invitation
					</Button>
				</>
			}
		>
			<form id="invite-form" className="stack" onSubmit={submit} noValidate>
				{error ? (
					<p role="alert" className="banner banner--error">
						{error}
					</p>
				) : null}
				<p className="muted small">They receive an email with a link to set their own password. Their role is applied as soon as they sign in.</p>
				<div className="form-grid">
					<Field label="First name" required error={fieldErrors.firstName}>
						{(p) => <input {...p} className="input" value={form.firstName} maxLength={50} autoComplete="off" onChange={set('firstName')} />}
					</Field>
					<Field label="Last name" required error={fieldErrors.lastName}>
						{(p) => <input {...p} className="input" value={form.lastName} maxLength={50} autoComplete="off" onChange={set('lastName')} />}
					</Field>
				</div>
				<Field label="Email" required error={fieldErrors.email}>
					{(p) => <input {...p} className="input" type="email" value={form.email} maxLength={120} autoComplete="off" onChange={set('email')} />}
				</Field>
				<Field label="Role" required error={fieldErrors.roleId} hint={role ? `${SCOPE_LABEL[role.scopeType]}. ${role.description || ''}` : undefined}>
					{(p) => (
						<Select {...p} value={form.roleKey} onChange={set('roleKey')}>
							{usable.map((r) => (
								<option key={r.key} value={r.key}>
									{r.name}
								</option>
							))}
						</Select>
					)}
				</Field>
				{canPickTeam && (needsTeam || form.teamId) ? (
					<Field label="Team" required={needsTeam} error={fieldErrors.teamId} hint={needsTeam ? 'This role works with one team, so a team is required.' : 'Optional for roles that cover every team.'}>
						{(p) => (
							<Select {...p} value={form.teamId} onChange={set('teamId')}>
								<option value="">Choose a team…</option>
								{teams.map((t) => (
									<option key={t.ROWID} value={t.ROWID}>
										{t.name}
									</option>
								))}
							</Select>
						)}
					</Field>
				) : null}
			</form>
		</Modal>
	);
}
