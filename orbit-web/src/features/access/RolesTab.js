import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/feedback/ToastProvider';
import { Radio } from '../../components/forms/Choice';
import SearchBox from '../../components/forms/SearchBox';
import Field from '../../components/forms/Field';
import { accessService } from '../../services/accessService';
import { describeKey, diff, setAll, touchesAccessControl } from './accessModel';
import PermissionMatrix from './PermissionMatrix';
import Select from '../../components/forms/Select';

export const SCOPE_LABEL = { all_teams: 'Every team', own_team: 'One team' };
const initialsOf = (name = '') =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('') || '?';
const SCOPE_HINT = { all_teams: 'Sees and manages the data of every team.', own_team: "Works only with the data of the team they are assigned to." };

function RoleBadges({ role }) {
	return (
		<>
			<span className={`badge badge--${role.scopeType === 'all_teams' ? 'info' : 'neutral'}`}>{SCOPE_LABEL[role.scopeType] || role.scopeType}</span>
			{role.isProtected ? <span className="badge badge--warning">Protected</span> : role.isSystem ? <span className="badge badge--neutral">Built-in</span> : null}
			{!role.isActive ? <span className="badge badge--error">Inactive</span> : null}
		</>
	);
}

/** New role: a name, who it covers, and an optional starting point copied from a role you could grant yourself. */
function NewRoleModal({ catalog, roles, canGrant, canAllTeams, onClose, onCreated }) {
	const { notify } = useToast();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [scopeType, setScope] = useState('own_team');
	const [copyFrom, setCopyFrom] = useState('');
	const [error, setError] = useState(null);
	const [fieldErrors, setFieldErrors] = useState({});
	const [saving, setSaving] = useState(false);

	const submit = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError(null);
		setFieldErrors({});
		const source = roles.find((r) => r.key === copyFrom);
		// Only permissions the creator holds can be copied (the server enforces the same rule).
		const permissions = source ? source.permissions.filter(canGrant) : [];
		try {
			const { data } = await accessService.createRole({ name, scopeType, ...(description.trim() ? { description } : {}), permissions });
			notify(`Role “${name.trim()}” created`);
			onCreated(data);
		} catch (err) {
			setFieldErrors(err.fieldErrors || {});
			setError(Object.keys(err.fieldErrors || {}).length ? 'Please fix the highlighted fields.' : err.message);
			setSaving(false);
		}
	};

	return (
		<Modal
			title="New role"
			onClose={onClose}
			footer={
				<>
					<Button onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" form="new-role-form" loading={saving} disabled={name.trim().length < 2}>
						Create role
					</Button>
				</>
			}
		>
			<form id="new-role-form" onSubmit={submit} noValidate className="stack">
				{error ? (
					<p role="alert" className="banner banner--error">
						{error}
					</p>
				) : null}
				<Field label="Role name" required error={fieldErrors.name} hint="For example “Team lead” or “HR viewer”.">
					{(p) => <input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
				</Field>
				<Field label="What is this role for? (optional)" error={fieldErrors.description}>
					{(p) => <input {...p} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />}
				</Field>
				<fieldset className="access-scope">
					<legend>Which teams does this role cover?</legend>
					<Radio name="role-scope" label="One team" hint={SCOPE_HINT.own_team} checked={scopeType === 'own_team'} onChange={() => setScope('own_team')} />
					<Radio name="role-scope" label="Every team" hint={canAllTeams ? SCOPE_HINT.all_teams : 'Only someone who can see every team can create this kind of role.'} checked={scopeType === 'all_teams'} disabled={!canAllTeams} onChange={() => setScope('all_teams')} />
				</fieldset>
				<Field label="Start from (optional)" hint="Copies that role's permissions, limited to the ones you hold yourself. You can change everything afterwards.">
					{(p) => (
						<Select {...p} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
							<option value="">Nothing, start empty</option>
							{roles
								.filter((r) => r.isActive)
								.map((r) => (
									<option key={r.key} value={r.key}>
										{r.name}
									</option>
								))}
						</Select>
					)}
				</Field>
			</form>
		</Modal>
	);
}

function EditRoleModal({ role, onClose, onSaved }) {
	const { notify } = useToast();
	const [name, setName] = useState(role.name);
	const [description, setDescription] = useState(role.description || '');
	const [error, setError] = useState(null);
	const [fieldErrors, setFieldErrors] = useState({});
	const [saving, setSaving] = useState(false);
	const submit = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError(null);
		setFieldErrors({});
		const body = {};
		if (name.trim() !== role.name) body.name = name;
		if (description.trim() !== (role.description || '')) body.description = description;
		try {
			if (Object.keys(body).length) await accessService.updateRole(role.id || role.key, body);
			notify('Role updated');
			onSaved();
		} catch (err) {
			setFieldErrors(err.fieldErrors || {});
			setError(Object.keys(err.fieldErrors || {}).length ? 'Please fix the highlighted fields.' : err.message);
			setSaving(false);
		}
	};
	return (
		<Modal
			title="Edit role details"
			onClose={onClose}
			footer={
				<>
					<Button onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" form="edit-role-form" loading={saving} disabled={name.trim().length < 2}>
						Save
					</Button>
				</>
			}
		>
			<form id="edit-role-form" onSubmit={submit} noValidate className="stack">
				{error ? (
					<p role="alert" className="banner banner--error">
						{error}
					</p>
				) : null}
				<Field label="Role name" required error={fieldErrors.name}>
					{(p) => <input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
				</Field>
				<Field label="What is this role for?" error={fieldErrors.description}>
					{(p) => <input {...p} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />}
				</Field>
			</form>
		</Modal>
	);
}

/**
 * Roles: a searchable list on the left; on the right the selected role's permission matrix. Changes
 * are made on a draft and only saved after a review step that names exactly what is added or removed.
 */
export default function RolesTab({ catalog, data, reload }) {
	const { can, user } = useAuth();
	const { notify } = useToast();
	const roles = data.roles;
	const canManage = can('access.manage_roles') && data.tablesReady;
	const [selectedKey, setSelectedKey] = useState(() => (roles[0] ? roles[0].key : ''));
	const [query, setQuery] = useState('');
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState(false);
	const [confirming, setConfirming] = useState(null); // 'save' | 'deactivate' | 'activate'
	const role = roles.find((r) => r.key === selectedKey) || roles[0];

	const saved = useMemo(() => new Set(role ? role.permissions : []), [role]);
	const [draft, setDraft] = useState(saved);
	useEffect(() => setDraft(saved), [saved]);
	const changes = useMemo(() => diff(saved, draft), [saved, draft]);
	const dirty = changes.added.length + changes.removed.length > 0;

	const shown = roles.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(query.trim().toLowerCase()));
	if (!role) return null;

	const own = user.roleKey === role.key;
	let lock = null;
	if (!data.tablesReady) lock = 'The access tables have not been created yet, so roles cannot be changed. See the setup note on the Overview tab.';
	else if (!can('access.manage_roles')) lock = 'You can view roles but not change them.';
	else if (role.isProtected) lock = 'The Administrator role is protected. It always holds every permission and cannot be changed.';
	else if (own) lock = 'This is your own role. Ask another administrator to change it.';
	else if (role.scopeType === 'all_teams' && user.scopeType !== 'all_teams') lock = 'Only someone who can see every team can change an all-teams role.';
	const editable = canManage && !lock;

	const save = async () => {
		await accessService.setPermissions(role.id || role.key, [...draft]);
		notify(`Permissions of “${role.name}” saved`);
		setConfirming(null);
		reload();
	};
	const setActive = async (isActive) => {
		await accessService.updateRole(role.id || role.key, { isActive });
		notify(isActive ? 'Role activated' : 'Role deactivated');
		setConfirming(null);
		reload();
	};

	const affected = role.userCount;
	const sensitive = touchesAccessControl([...changes.added, ...changes.removed]);

	return (
		<div className="access-split">
			<aside className="access-list" aria-label="Roles">
				<div className="access-list__head">
<SearchBox aria-label="Search roles" placeholder="Search roles" value={query} onChange={setQuery} />
					{can('access.manage_roles') ? (
						<Button size="sm" icon="plus" onClick={() => setCreating(true)} disabled={!data.tablesReady} title={data.tablesReady ? undefined : 'Create the access tables first'}>
							New role
						</Button>
					) : null}
				</div>
				<ul>
					{shown.map((r) => (
						<li key={r.key}>
							<button type="button" className={`access-role ${r.key === role.key ? 'is-selected' : ''}`.trim()} aria-current={r.key === role.key ? 'true' : undefined} onClick={() => setSelectedKey(r.key)}>
								<span className="access-role__avatar" aria-hidden="true">
									{initialsOf(r.name)}
								</span>
								<span className="access-role__text">
									<span className="access-role__name">{r.name}</span>
									<span className="access-role__meta">
										<RoleBadges role={r} />
									</span>
									<span className="access-role__count">
										{r.userCount} {r.userCount === 1 ? 'user' : 'users'} · {r.permissions.length} permissions
									</span>
								</span>
							</button>
						</li>
					))}
					{shown.length === 0 ? <li className="muted small access-list__empty">No role matches “{query}”.</li> : null}
				</ul>
			</aside>

			<section className="access-detail" aria-label={`Role: ${role.name}`}>
				<header className="access-detail__head">
					<div>
						<h2>{role.name}</h2>
						<p className="muted">{role.description || 'No description yet.'}</p>
						<p className="access-detail__badges">
							<RoleBadges role={role} />
							<span className="muted small">
								{role.userCount} {role.userCount === 1 ? 'user holds' : 'users hold'} this role{role.source === 'default' ? ' · using built-in defaults' : ''}
							</span>
						</p>
					</div>
					{editable ? (
						<div className="access-detail__actions">
							<Button size="sm" icon="edit" onClick={() => setEditing(true)}>
								Edit details
							</Button>
							{!role.isSystem ? (
								<Button size="sm" variant={role.isActive ? 'danger' : 'secondary'} onClick={() => setConfirming(role.isActive ? 'deactivate' : 'activate')}>
									{role.isActive ? 'Deactivate' : 'Activate'}
								</Button>
							) : null}
						</div>
					) : null}
				</header>

				{lock ? (
					<p className="banner banner--info" role="note">
						{lock}
					</p>
				) : null}

				{editable ? (
					<div className="access-toolbar">
						<Button size="sm" onClick={() => setDraft(setAll(catalog, true))}>
							Select everything
						</Button>
						<Button size="sm" onClick={() => setDraft(new Set())}>
							Clear everything
						</Button>
						<span className="access-toolbar__spacer" />
						<span className="muted small" role="status" aria-live="polite">
							{dirty ? `${changes.added.length} to add, ${changes.removed.length} to remove` : 'No unsaved changes'}
						</span>
						<Button onClick={() => setDraft(saved)} disabled={!dirty}>
							Reset
						</Button>
						<Button variant="primary" onClick={() => setConfirming('save')} disabled={!dirty}>
							Review and save
						</Button>
					</div>
				) : null}

				<PermissionMatrix catalog={catalog} value={editable ? draft : saved} saved={editable ? saved : null} revoked={new Set(role.revoked)} onChange={editable ? setDraft : null} label={`Permissions of ${role.name}`} />
				<ul className="access-legend" aria-label="Legend">
					<li>
						<span className="pm__legend pm__legend--on" aria-hidden="true" />
						Granted
					</li>
					<li>
						<span className="pm__legend" aria-hidden="true" />
						Not granted
					</li>
					<li>
						<span className="pm__legend pm__legend--revoked" aria-hidden="true" />
						Granted before, then revoked
					</li>
				</ul>
				<p className="muted small access-legend__note">There are no per-person exceptions: everyone with this role has exactly these permissions. Anything not granted is denied.</p>
			</section>

			{creating ? (
				<NewRoleModal
					catalog={catalog}
					roles={roles}
					canGrant={can}
					canAllTeams={user.scopeType === 'all_teams'}
					onClose={() => setCreating(false)}
					onCreated={(created) => {
						setCreating(false);
						setSelectedKey(created.key);
						reload();
					}}
				/>
			) : null}
			{editing ? (
				<EditRoleModal
					role={role}
					onClose={() => setEditing(false)}
					onSaved={() => {
						setEditing(false);
						reload();
					}}
				/>
			) : null}
			{confirming === 'save' ? (
				<ConfirmDialog
					title={`Save permissions for “${role.name}”?`}
					confirmLabel="Save permissions"
					confirmVariant={sensitive ? 'danger' : 'primary'}
					onCancel={() => setConfirming(null)}
					onConfirm={save}
					message={
						<>
							<span className="access-review">
								{changes.added.length ? (
									<span>
										<b>Added ({changes.added.length}):</b> {changes.added.map((k) => describeKey(catalog, k)).join(', ')}
									</span>
								) : null}
								{changes.removed.length ? (
									<span>
										<b>Removed ({changes.removed.length}):</b> {changes.removed.map((k) => describeKey(catalog, k)).join(', ')}
									</span>
								) : null}
							</span>
							<span className="access-review__note">
								{affected > 0 ? `${affected} ${affected === 1 ? 'person holds' : 'people hold'} this role. ` : 'Nobody holds this role yet. '}
								Their access changes right away (at most a minute on other open sessions).
								{sensitive ? ' This changes who can manage roles and users, so check it twice.' : ''}
							</span>
						</>
					}
				/>
			) : null}
			{confirming === 'deactivate' ? (
				<ConfirmDialog title={`Deactivate “${role.name}”?`} confirmLabel="Deactivate" message={affected > 0 ? `${affected} ${affected === 1 ? 'person still holds' : 'people still hold'} this role. Move them to another role first; the server will refuse until then.` : 'Nobody can be given an inactive role. You can activate it again at any time.'} onCancel={() => setConfirming(null)} onConfirm={() => setActive(false)} />
			) : null}
			{confirming === 'activate' ? <ConfirmDialog title={`Activate “${role.name}”?`} confirmLabel="Activate" confirmVariant="primary" message="People can be given this role again." onCancel={() => setConfirming(null)} onConfirm={() => setActive(true)} /> : null}
		</div>
	);
}
