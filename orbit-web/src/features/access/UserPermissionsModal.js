import React, { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StateView from '../../components/feedback/StateView';
import { useToast } from '../../components/feedback/ToastProvider';
import useApiResource from '../../hooks/useApiResource';
import { accessService } from '../../services/accessService';
import { groupModules, keyOf } from './accessModel';

// What one cell can be: follow the role (inherit), add on top of the role (allow), take away from the role (deny).
const NEXT = { inherit: 'allow', allow: 'deny', deny: 'inherit' };

/**
 * One person's individual permissions: the role they hold, plus what they may additionally do (allow) or may not do
 * (deny). Click a cell to cycle follow-role -> allow -> deny. The server refuses anything the editor could not do
 * themselves, and Administrators always hold everything.
 */
export default function UserPermissionsModal({ person, catalog, onClose, onSaved }) {
	const { notify } = useToast();
	const res = useApiResource((signal) => accessService.userAccess(person.id, { signal }), `access-user-perms|${person.id}`, { isEmpty: () => false });
	const info = res.data;
	const [state, setState] = useState(null); // key -> 'allow' | 'deny'
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!info) return;
		setState(Object.fromEntries([...info.allow.map((k) => [k, 'allow']), ...info.deny.map((k) => [k, 'deny'])]));
	}, [info]);

	const roleHas = useMemo(() => new Set(info ? info.rolePermissions : []), [info]);
	const groups = useMemo(() => groupModules(catalog), [catalog]);
	const editable = Boolean(info && info.canEdit);
	const effectOf = (key) => (state && state[key]) || 'inherit';
	const dirty = info && state && (JSON.stringify([...info.allow].sort()) !== JSON.stringify(Object.keys(state).filter((k) => state[k] === 'allow').sort()) || JSON.stringify([...info.deny].sort()) !== JSON.stringify(Object.keys(state).filter((k) => state[k] === 'deny').sort()));

	const count = (effect) => (state ? Object.values(state).filter((v) => v === effect).length : 0);
	const summary = [count('allow') ? `${count('allow')} added to the role` : '', count('deny') ? `${count('deny')} taken away` : ''].filter(Boolean).join(', ');
	// every box of one module (a row) or one action (a column) at once: follow the role again, or allow / deny the whole line
	const setMany = (keys, effect) =>
		setState((s) => {
			const out = { ...s };
			keys.forEach((k) => {
				if (effect === 'inherit') delete out[k];
				else out[k] = effect;
			});
			return out;
		});
	const moduleKeys = (m) => m.actions.map((a) => keyOf(m.key, a));

	const cycle = (key) =>
		setState((s) => {
			const next = NEXT[(s && s[key]) || 'inherit'];
			const out = { ...s };
			if (next === 'inherit') delete out[key];
			else out[key] = next;
			return out;
		});

	const save = async () => {
		setSaving(true);
		setError('');
		try {
			await accessService.setUserPermissions(person.id, Object.keys(state).filter((k) => state[k] === 'allow'), Object.keys(state).filter((k) => state[k] === 'deny'));
			notify(`Individual permissions updated for ${person.displayName}`, 'success');
			onSaved();
		} catch (err) {
			setError(err.message);
			setSaving(false);
		}
	};

	const describe = (key) => {
		const e = effectOf(key);
		if (e === 'allow') return roleHas.has(key) ? 'allowed (also in the role)' : 'allowed in addition to the role';
		if (e === 'deny') return roleHas.has(key) ? 'denied, although the role has it' : 'denied';
		return roleHas.has(key) ? 'allowed by the role' : 'not allowed';
	};

	return (
		<Modal
			title={`Individual permissions: ${person.displayName}`}
			size="lg"
			onClose={onClose}
			dismissible={!saving}
			footer={
				<>
					<Button onClick={onClose} disabled={saving}>
						{editable ? 'Cancel' : 'Close'}
					</Button>
					{editable ? (
						<Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
							Save permissions
						</Button>
					) : null}
				</>
			}
		>
			<StateView res={res} loadingLines={6}>
				{info && state ? (
					<div className="stack">
						{error ? (
							<p role="alert" className="banner banner--error">
								{error}
							</p>
						) : null}
						<p className="muted small">
							Role: <b>{info.role ? info.role.name : 'none'}</b>.{' '}
							{info.locked ? 'Administrators always hold every permission, so individual changes do not apply.' : editable ? 'Click a box to cycle: follows the role, allowed, denied.' : 'You can see these but not change them.'}
						</p>
						<div className="up-summary" role="status" aria-live="polite">
							<span>{summary || 'No individual changes: this person follows the role.'}</span>
							{editable && !info.locked && state && Object.keys(state).length ? (
								<Button size="sm" variant="ghost" icon="refresh" onClick={() => setState({})}>
									Reset to the role
								</Button>
							) : null}
						</div>
						<div className="up-legend" aria-hidden="true">
							<span className="up-cell up-cell--role">✓ role</span>
							<span className="up-cell up-cell--allow">+ allow</span>
							<span className="up-cell up-cell--deny">− deny</span>
							<span className="up-cell">follows the role</span>
						</div>
						<div className="pm-wrap" role="region" aria-label="Individual permissions" tabIndex={0}>
							<table className="pm">
								<thead>
									<tr>
										<th scope="col" className="pm__module">
											Module
										</th>
										{catalog.actions.map((a) => (
											<th key={a.key} scope="col" title={a.description}>
												{a.label}
											</th>
										))}
									</tr>
								</thead>
								{groups.map((g) => (
									<tbody key={g.name}>
										<tr className="pm__group">
											<th colSpan={catalog.actions.length + 1} scope="colgroup">
												{g.name}
											</th>
										</tr>
										{g.modules.map((m) => (
											<tr key={m.key}>
												<th scope="row" className="pm__module">
<span>{m.label}</span>
													{editable && !info.locked ? (
														<span className="pm__row-tools">
															<button type="button" className="pm__tool" aria-label={`Allow everything in ${m.label}`} title="Allow everything in this module" onClick={() => setMany(moduleKeys(m), 'allow')}>
																+
															</button>
															<button type="button" className="pm__tool" aria-label={`Follow the role for ${m.label}`} title="Follow the role for this module" onClick={() => setMany(moduleKeys(m), 'inherit')}>
																↺
															</button>
														</span>
													) : null}
												</th>
												{catalog.actions.map((a) => {
													if (!m.actions.includes(a.key)) {
														return (
															<td key={a.key} className="pm__na" aria-label={`${m.label}: ${a.label} not applicable`}>
																<span aria-hidden="true">–</span>
															</td>
														);
													}
													const key = keyOf(m.key, a.key);
													const e = effectOf(key);
													const granted = info.locked || (e === 'allow' ? true : e === 'deny' ? false : roleHas.has(key));
													const mark = info.locked ? '✓' : e === 'allow' ? '+' : e === 'deny' ? '−' : roleHas.has(key) ? '✓' : '';
													return (
														<td key={a.key} className="pm__cell">
															<button
																type="button"
																className={`up-cell up-cell--${info.locked ? 'role' : e === 'inherit' ? (roleHas.has(key) ? 'role' : 'none') : e}`}
																aria-label={`${m.label}: ${a.label}, ${info.locked ? 'always allowed' : describe(key)}`}
																aria-pressed={granted}
																disabled={!editable}
																onClick={() => cycle(key)}
															>
																{mark}
															</button>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								))}
							</table>
						</div>
					</div>
				) : null}
			</StateView>
		</Modal>
	);
}
