import React from 'react';
import { columnFull, groupModules, keyOf, moduleFull, setColumn, setModule, toggle } from './accessModel';

/**
 * Role x permission matrix, one row per module, one column per action. A cell exists only where the
 * module really has that action. `value` is the working set of permission keys; `saved` the stored
 * set (changed cells are marked); `revoked` the keys that were granted once and then taken away.
 * Without `onChange` the matrix is read-only.
 */
export default function PermissionMatrix({ catalog, value, saved, revoked = new Set(), onChange, label = 'Permissions' }) {
	const editable = Boolean(onChange);
	const groups = groupModules(catalog);
	const change = (next) => onChange(next);

	return (
		<div className="pm-wrap" role="region" aria-label={label} tabIndex={0}>
			<table className="pm">
				<thead>
					<tr>
						<th scope="col" className="pm__module">
							Module
						</th>
						{catalog.actions.map((a) => (
							<th key={a.key} scope="col" title={a.description}>
								<span className="pm__colhead">
									{a.label}
									{editable ? (
										<button type="button" className="pm__bulk" aria-label={`${columnFull(value, catalog, a.key) ? 'Clear' : 'Select'} ${a.label} for every module`} onClick={() => change(setColumn(value, catalog, a.key, !columnFull(value, catalog, a.key)))}>
											{columnFull(value, catalog, a.key) ? 'Clear' : 'All'}
										</button>
									) : null}
								</span>
							</th>
						))}
						{editable ? (
							<th scope="col" className="pm__rowbulk">
								<span className="sr-only">Whole module</span>
							</th>
						) : null}
					</tr>
				</thead>
				{groups.map((g) => (
					<tbody key={g.name}>
						<tr className="pm__group">
							<th colSpan={catalog.actions.length + (editable ? 2 : 1)} scope="colgroup">
								{g.name}
							</th>
						</tr>
						{g.modules.map((m) => (
							<tr key={m.key}>
								<th scope="row" className="pm__module">
									<span>{m.label}</span>
									<small>{m.description}</small>
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
									const on = value.has(key);
									const changed = saved ? saved.has(key) !== on : false;
									const wasRevoked = !on && revoked.has(key);
									return (
										<td key={a.key} className={`pm__cell ${changed ? 'is-changed' : ''}`.trim()}>
											<input
												type="checkbox"
												className="pm__box"
												checked={on}
												disabled={!editable}
												onChange={() => change(toggle(value, catalog, m.key, a.key))}
												aria-label={`${m.label}: ${a.label}`}
												title={wasRevoked ? 'Granted before, then revoked' : changed ? 'Changed, not saved yet' : undefined}
											/>
											{wasRevoked ? <span className="pm__revoked" aria-hidden="true" /> : null}
										</td>
									);
								})}
								{editable ? (
									<td className="pm__rowbulk">
										<button type="button" className="pm__bulk" aria-label={`${moduleFull(value, catalog, m.key) ? 'Clear' : 'Select'} everything for ${m.label}`} onClick={() => change(setModule(value, catalog, m.key, !moduleFull(value, catalog, m.key)))}>
											{moduleFull(value, catalog, m.key) ? 'Clear row' : 'All'}
										</button>
									</td>
								) : null}
							</tr>
						))}
					</tbody>
				))}
			</table>
		</div>
	);
}
