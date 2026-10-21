import React, { useMemo, useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/feedback/EmptyState';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import { Switch } from '../../components/forms/Choice';
import Field from '../../components/forms/Field';
import DataTable from '../../components/tables/DataTable';
import Pagination from '../../components/tables/Pagination';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { accessService } from '../../services/accessService';
import { resourceService } from '../../services/resourceService';
import { SCOPE_LABEL } from './RolesTab';
import InviteModal from './InviteModal';
import UserPermissionsModal from './UserPermissionsModal';
import Select from '../../components/forms/Select';

/**
 * One user's access: role, team and whether they can sign in. Two steps (edit, then review) so a
 * sensitive change is never one click. The server applies the same rules and explains any refusal.
 */
function EditAccessModal({ person, roles, teams, canPickTeam, onClose, onSaved }) {
	const { notify } = useToast();
	const [roleKey, setRoleKey] = useState(person.roleKey || '');
	const [teamId, setTeamId] = useState(person.teamId || '');
	const [isActive, setActive] = useState(person.isActive);
	const [reviewing, setReviewing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);
	const [fieldErrors, setFieldErrors] = useState({});

	const current = roles.find((r) => r.key === person.roleKey);
	const next = roles.find((r) => r.key === roleKey);
	const needsTeam = Boolean(next) && next.scopeType === 'own_team';
	const body = {};
	if (roleKey && roleKey !== person.roleKey) body.roleId = next.id || next.key;
	if (canPickTeam && teamId && teamId !== (person.teamId || '')) body.teamId = teamId;
	if (isActive !== person.isActive) body.isActive = isActive;
	const changed = Object.keys(body).length > 0;
	const teamName = (id) => (teams.find((t) => String(t.ROWID) === String(id)) || {}).name || (id ? `Team ${id}` : 'No team');

	const confirm = async () => {
		setSaving(true);
		setError(null);
		setFieldErrors({});
		try {
			await accessService.updateUser(person.id, body);
			notify(`Access updated for ${person.displayName}`);
			onSaved();
		} catch (err) {
			setFieldErrors(err.fieldErrors || {});
			setError(err.message);
			setReviewing(false);
			setSaving(false);
		}
	};

	const lines = [];
	if (body.roleId) lines.push(`Role: ${current ? current.name : 'none'} → ${next.name}`);
	if (body.teamId) lines.push(`Team: ${teamName(person.teamId)} → ${teamName(teamId)}`);
	if (body.isActive !== undefined) lines.push(isActive ? 'Can sign in again' : 'Can no longer sign in');

	return (
		<Modal
			title={reviewing ? 'Review the change' : `Edit access: ${person.displayName}`}
			onClose={onClose}
			dismissible={!saving}
			footer={
				reviewing ? (
					<>
						<Button onClick={() => setReviewing(false)} disabled={saving}>
							Back
						</Button>
						<Button variant={body.isActive === false ? 'danger' : 'primary'} onClick={confirm} loading={saving}>
							Confirm change
						</Button>
					</>
				) : (
					<>
						<Button onClick={onClose}>Cancel</Button>
						<Button variant="primary" onClick={() => setReviewing(true)} disabled={!changed || (needsTeam && !teamId && !person.teamId)}>
							Review
						</Button>
					</>
				)
			}
		>
			{error ? (
				<p role="alert" className="banner banner--error">
					{error}
				</p>
			) : null}
			{reviewing ? (
				<div className="stack">
					<p>
						<b>{person.displayName}</b> ({person.email})
					</p>
					<ul className="access-review-list">
						{lines.map((l) => (
							<li key={l}>{l}</li>
						))}
					</ul>
					<p className="muted small">The change applies right away. Other open sessions of this person pick it up within a minute.</p>
				</div>
			) : (
				<div className="stack">
					<Field label="Role" hint={next ? `${SCOPE_LABEL[next.scopeType]}. ${next.description || ''}` : undefined}>
						{(p) => (
							<Select {...p} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
								{roles
									.filter((r) => r.isActive || r.key === person.roleKey)
									.map((r) => (
										<option key={r.key} value={r.key}>
											{r.name}
										</option>
									))}
							</Select>
						)}
					</Field>
					{canPickTeam ? (
						<Field label="Team" error={fieldErrors.teamId} hint={needsTeam ? 'This role works with one team, so a team is required.' : 'Used by roles that cover one team.'}>
							{(p) => (
								<Select {...p} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
									<option value="">{person.teamId ? '(keep current)' : 'Choose a team…'}</option>
									{teams.map((t) => (
										<option key={t.ROWID} value={t.ROWID}>
											{t.name}
										</option>
									))}
								</Select>
							)}
						</Field>
					) : null}
					<Switch label="Can sign in" hint="Switch off to block this person without deleting anything." checked={isActive} onChange={(e) => setActive(e.target.checked)} />
				</div>
			)}
		</Modal>
	);
}

const personInitials = (name = '') =>
	name
		.split(/[\s@.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('') || '?';

/** People who can sign in, with the role each holds. Managers of a team only ever see their own team. */
export default function UsersTab({ data, catalog, reload: reloadRoles }) {
	const { can, user } = useAuth();
	const canManage = can('access.manage_users') && data.tablesReady;
	const [q, setQ] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [editing, setEditing] = useState(null);
	const [permsFor, setPermsFor] = useState(null);
	const [inviting, setInviting] = useState(false);
	const dq = useDebouncedValue(q, 300).trim();
	const res = useApiResource((signal) => accessService.users({ q: dq || undefined, page, pageSize }, { signal }), `access-users|${dq}|${page}|${pageSize}`, { isEmpty: () => false });
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'access-teams', { enabled: can('teams.view'), isEmpty: () => false });
	const teamList = teams.data || [];
	const nameOfTeam = (id) => (id ? (teamList.find((t) => String(t.ROWID) === String(id)) || {}).name || `Team ${id}` : '—');
	const rows = res.data || [];
	const roleByKey = useMemo(() => new Map(data.roles.map((r) => [r.key, r])), [data.roles]);

	return (
		<div className="stack">
			{!data.tablesReady ? (
				<p className="banner banner--info" role="note">
					People are shown with their built-in role. Roles can be assigned once the access tables have been created (see the Overview tab).
				</p>
			) : null}
			<div className="access-toolbar">
				<input
					type="search"
					className="input"
					aria-label="Search users"
					placeholder="Search by name or email"
					value={q}
					onChange={(e) => {
						setQ(e.target.value);
						setPage(1);
					}}
				/>
				<span className="access-toolbar__spacer" />
				{canManage ? (
					<Button variant="primary" size="sm" icon="plus" onClick={() => setInviting(true)}>
						Invite user
					</Button>
				) : null}
				{res.meta ? (
					<span className="muted small" role="status" aria-live="polite">
						{res.meta.total} {res.meta.total === 1 ? 'person' : 'people'}
						{dq ? ` match “${dq}”` : ''}
					</span>
				) : null}
			</div>
			<StateView res={res} loadingLines={6} emptyTitle="No users">
				{rows.length === 0 ? (
					<EmptyState icon="search" title={dq ? 'No one matches your search' : 'No users yet'} message={dq ? 'Try a different name or email.' : 'People appear here once they are added to Company 360.'} />
				) : (
					<>
						<DataTable
							caption="Users and their roles"
							columns={[
								{
									key: 'displayName',
									label: 'User',
									render: (r) => (
										<span className="access-user access-user--avatar">
											<span className="access-avatar" aria-hidden="true">
												{personInitials(r.displayName)}
											</span>
											<span className="access-user">
												<b>{r.displayName}</b>
												<small>{r.email}</small>
											</span>
										</span>
									),
								},
								{
									key: 'roleName',
									label: 'Role',
									render: (r) => {
										const role = roleByKey.get(r.roleKey);
										return (
											<span className="access-user">
												<b>{r.roleName || '—'}</b>
												<small>{role ? SCOPE_LABEL[role.scopeType] : ''}{r.roleSource === 'default' ? ' · built-in' : ''}</small>
											</span>
										);
									},
								},
								{ key: 'teamId', label: 'Team', render: (r) => nameOfTeam(r.teamId) },
								{ key: 'isActive', label: 'Status', render: (r) => <span className={`badge badge--${r.isActive ? 'success' : 'neutral'}`}>{r.isActive ? 'Active' : 'Inactive'}</span> },
								{ key: 'overrideCount', label: 'Individual', render: (r) => (r.overrideCount ? <span className="badge badge--info">{r.overrideCount} custom</span> : <span className="muted small">Role only</span>) },
							]}
							rows={rows}
							rowActions={
								canManage
									? (r) =>
											r.id === user.userId ? (
												<span className="muted small">You</span>
											) : (
												<span className="access-actions">
													<Button size="sm" icon="edit" aria-label={`Edit access for ${r.displayName}`} onClick={() => setEditing(r)}>
														Edit access
													</Button>
													<Button size="sm" icon="lock" aria-label={`Individual permissions for ${r.displayName}`} onClick={() => setPermsFor(r)}>
														Permissions
													</Button>
												</span>
											)
									: undefined
							}
						/>
						<Pagination meta={res.meta} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
					</>
				)}
			</StateView>
			{inviting ? (
				<InviteModal
					roles={data.roles}
					teams={teamList}
					canPickTeam={user.scopeType === 'all_teams' && can('teams.view')}
					ownTeamId={user.scopeType === 'all_teams' ? '' : user.teamId}
					onClose={() => setInviting(false)}
					onInvited={() => {
						setInviting(false);
						res.reload();
						reloadRoles();
					}}
				/>
			) : null}
			{permsFor ? (
				<UserPermissionsModal
					person={permsFor}
					catalog={catalog}
					onClose={() => setPermsFor(null)}
					onSaved={() => {
						setPermsFor(null);
						res.reload();
					}}
				/>
			) : null}
			{editing ? (
				<EditAccessModal
					person={editing}
					roles={data.roles}
					teams={teamList}
					canPickTeam={user.scopeType === 'all_teams' && can('teams.view')}
					onClose={() => setEditing(null)}
					onSaved={() => {
						setEditing(null);
						res.reload();
						reloadRoles();
					}}
				/>
			) : null}
		</div>
	);
}
