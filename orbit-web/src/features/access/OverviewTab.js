import React, { useMemo, useState } from 'react';
import Card from '../../components/cards/Card';
import KpiCard from '../../components/cards/KpiCard';
import useApiResource from '../../hooks/useApiResource';
import { accessService } from '../../services/accessService';
import { allKeys, groupModules, summarize } from './accessModel';
import { SCOPE_LABEL } from './RolesTab';

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

/** Pick a person and see what their role lets them do, module by module. */
function PersonCheck({ roles, catalog }) {
	const users = useApiResource((signal) => accessService.users({ pageSize: 50 }, { signal }), 'access-overview-users', { isEmpty: () => false });
	const [id, setId] = useState('');
	const person = (users.data || []).find((u) => u.id === id);
	const role = person ? roles.find((r) => r.key === person.roleKey) : null;
	const summary = role ? summarize(new Set(role.permissions), catalog) : [];
	return (
		<Card title="Check a person's access" subtitle="What someone can do is exactly what their role allows. Pick a person to see it.">
			<div className="stack">
				<label className="field">
					<span className="access-check__label">Person</span>
					<select className="input" value={id} onChange={(e) => setId(e.target.value)} aria-label="Person to check" disabled={users.status === 'loading' && !users.data}>
						<option value="">Choose a person…</option>
						{(users.data || []).map((u) => (
							<option key={u.id} value={u.id}>
								{u.displayName} ({u.email})
							</option>
						))}
					</select>
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
				) : null}
			</div>
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
			<div className="grid grid--kpi">
				<KpiCard label="Roles" value={String(active.length)} hint={roles.length !== active.length ? `${roles.length - active.length} inactive` : 'all active'} />
				<KpiCard label="Users" value={users.meta ? String(users.meta.total) : users.status === 'error' ? '—' : '…'} hint="who can sign in or are blocked" />
				<KpiCard label="Modules" value={String(catalog.modules.length)} hint="each with its own actions" />
				<KpiCard label="Permissions" value={String(total)} hint="module and action pairs" />
			</div>

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
											return (
												<td key={r.key} className={have.length === m.actions.length ? 'pm__full' : have.length ? 'pm__some' : 'pm__none'}>
													{have.length === 0 ? <span aria-label="No access">—</span> : have.length === m.actions.length ? 'Full' : labels.join(', ')}
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

			<PersonCheck roles={roles} catalog={catalog} />
		</div>
	);
}
