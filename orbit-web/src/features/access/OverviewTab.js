import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/cards/Card';
import Icon from '../../components/common/Icon';
import useApiResource from '../../hooks/useApiResource';
import { accessService } from '../../services/accessService';
import { allKeys, groupModules, summarize } from './accessModel';
import { SCOPE_LABEL } from './RolesTab';
import Select from '../../components/forms/Select';

function SetupNote() {
	return (
		<section className="banner banner--warning access-setup" role="note" aria-label="Access tables not created">
			<b>The access tables have not been created yet.</b>
			<p>
				Everyone currently uses the two built-in roles (Administrator and Manager), exactly as before, and this screen is read-only. To create your own roles and assign them, create three tables in the Data Store: <code>roles</code>, <code>role_permissions</code> and <code>user_roles</code>. The exact columns are in <code>data/access-permissions-schema.md</code>. Reload this page afterwards; nothing else needs to change.
			</p>
		</section>
	);
}

/** One headline figure: an icon, the number, and what it counts, in a single compact tile. */
function Stat({ icon, label, value, hint }) {
	return (
		<div className="access-stat" role="group" aria-label={label}>
			<span className="access-stat__icon" aria-hidden="true">
				<Icon name={icon} size={20} />
			</span>
			<span className="access-stat__body">
				<span className="access-stat__label">{label}</span>
				<b className="access-stat__value num">{value}</b>
				<span className="access-stat__hint">{hint}</span>
			</span>
		</div>
	);
}

/** Pick a person and see what their role lets them do, module by module. */
function PersonCheck({ roles, catalog }) {
	const users = useApiResource((signal) => accessService.users({ pageSize: 50 }, { signal }), 'access-overview-users', { isEmpty: () => false });
	const [id, setId] = useState('');
	const person = (users.data || []).find((u) => u.id === id);
	const role = person ? roles.find((r) => r.key === person.roleKey) : null;
	const summary = role ? summarize(new Set(role.permissions), catalog) : [];
	return (
		<Card icon="user" title="Check a person's access" subtitle="What someone can do is exactly what their role allows.">
			<div className="stack">
				<label className="field">
					<span className="access-check__label">Person</span>
					<Select className="input" value={id} onChange={(e) => setId(e.target.value)} aria-label="Person to check" disabled={users.status === 'loading' && !users.data}>
						<option value="">Choose a person…</option>
						{(users.data || []).map((u) => (
							<option key={u.id} value={u.id}>
								{u.displayName} ({u.email})
							</option>
						))}
					</Select>
				</label>
				{users.status === 'error' ? <p className="muted small">The list of people could not be loaded.</p> : null}
				{person && role ? (
					<div className="stack" aria-live="polite">
						<p>
							<b>{person.displayName}</b> holds <b>{role.name}</b>. {SCOPE_LABEL[role.scopeType]}
							{person.isActive ? '' : ' · currently cannot sign in'}.
						</p>
						{summary.length === 0 ? (
							<p className="muted">This role has no permissions: the person can sign in but cannot use any module.</p>
						) : (
							<ul className="access-summary">
								{summary.map((m) => (
									<li key={m.module}>
										<span>{m.label}</span>
										<span>{m.actions.join(' · ')}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				) : (
					<p className="muted small access-check__empty">Pick someone to see which modules they can open and what they can do in each.</p>
				)}
			</div>
		</Card>
	);
}

/** Each role with how much of the catalogue it grants, so the difference between roles is visible at a glance. */
function RolesGlance({ roles, total }) {
	return (
		<Card icon="lock" title="Roles at a glance" actions={<Link className="card__link" to="?tab=roles">Manage roles</Link>}>
			<ul className="access-glance">
				{roles.map((r) => {
					const pct = total ? Math.round((r.permissions.length / total) * 100) : 0;
					return (
						<li key={r.key}>
							<div className="access-glance__head">
								<b>{r.name}</b>
								<span className="muted small">
									{r.userCount} {r.userCount === 1 ? 'user' : 'users'}
								</span>
							</div>
							<div className="access-glance__bar" role="img" aria-label={`${r.name} holds ${r.permissions.length} of ${total} permissions`}>
								<span style={{ width: `${pct}%` }} />
							</div>
							<div className="access-glance__meta">
								<span>
									{r.permissions.length} of {total} permissions
								</span>
								<span className={`badge badge--${r.scopeType === 'all_teams' ? 'info' : 'neutral'}`}>{SCOPE_LABEL[r.scopeType]}</span>
							</div>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}

export default function OverviewTab({ catalog, data }) {
	const roles = data.roles;
	const active = roles.filter((r) => r.isActive);
	const users = useApiResource((signal) => accessService.users({ pageSize: 1 }, { signal }), 'access-overview-count', { isEmpty: () => false });
	const groups = useMemo(() => groupModules(catalog), [catalog]);
	const total = allKeys(catalog).length;

	return (
		<div className="stack">
			{!data.tablesReady ? <SetupNote /> : null}
			<div className="access-stats">
				<Stat icon="lock" label="Roles" value={String(active.length)} hint={roles.length !== active.length ? `${roles.length - active.length} inactive` : 'all active'} />
				<Stat icon="users" label="Users" value={users.meta ? String(users.meta.total) : users.status === 'error' ? '—' : '…'} hint="who can sign in or are blocked" />
				<Stat icon="box" label="Modules" value={String(catalog.modules.length)} hint="each with its own actions" />
				<Stat icon="check" label="Permissions" value={String(total)} hint="module and action pairs" />
			</div>

			<div className="access-overview">
				<Card title="Who can do what" subtitle="Each column is a role; each cell lists what that role may do in the module.">
					<div className="pm-wrap" role="region" aria-label="Role and module overview" tabIndex={0}>
						<table className="pm pm--overview">
							<thead>
								<tr>
									<th scope="col" className="pm__module">
										Module
									</th>
									{roles.map((r) => (
										<th key={r.key} scope="col">
											{r.name}
											<small>{SCOPE_LABEL[r.scopeType]}</small>
										</th>
									))}
								</tr>
							</thead>
							{groups.map((g) => (
								<tbody key={g.name}>
									<tr className="pm__group">
										<th colSpan={roles.length + 1} scope="colgroup">
											{g.name}
										</th>
									</tr>
									{g.modules.map((m) => (
										<tr key={m.key}>
											<th scope="row" className="pm__module">
												{m.label}
											</th>
											{roles.map((r) => {
												const set = new Set(r.permissions);
												const have = m.actions.filter((a) => set.has(`${m.key}.${a}`));
												const labels = have.map((a) => (catalog.actions.find((x) => x.key === a) || { label: a }).label);
												const level = have.length === m.actions.length ? 'full' : have.length ? 'some' : 'none';
												return (
													<td key={r.key} className={`pm__${level}`}>
														{level === 'none' ? (
															<span aria-label="No access">—</span>
														) : (
															<span className={`pm__pill pm__pill--${level}`}>{level === 'full' ? 'Full' : labels.join(', ')}</span>
														)}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							))}
						</table>
					</div>
				</Card>

				<div className="access-side">
					<PersonCheck roles={roles} catalog={catalog} />
					<RolesGlance roles={roles} total={total} />
				</div>
			</div>
		</div>
	);
}
