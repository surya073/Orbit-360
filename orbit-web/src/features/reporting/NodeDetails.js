import React, { useId, useState } from 'react';
import Button from '../../components/common/Button';
import Combobox from '../../components/forms/Combobox';
import Field from '../../components/forms/Field';
import EmployeeAvatar from './EmployeeAvatar';
import { canAssign, childrenMap, MAX_ROLE_LENGTH, ROLE_SUGGESTIONS } from './treeModel';

const Fact = ({ label, value }) => (
	<div className="rs-fact">
		<dt>{label}</dt>
		<dd className={value ? '' : 'is-missing'}>{value || 'Not recorded'}</dd>
	</div>
);

/** Searchable manager picker: the accessible alternative to dragging. Options are placed employees that are valid managers. */
function ManagerPicker({ employee, tree, byId, value, onPick, label }) {
	const [q, setQ] = useState('');
	const options = Object.keys(tree)
		.filter((id) => id !== employee.id && byId.has(id) && canAssign(tree, employee.id, id).ok)
		.map((id) => ({ value: id, label: byId.get(id).name, detail: tree[id].roleLabel || byId.get(id).jobRole || undefined }))
		.filter((o) => !q || `${o.label} ${o.detail || ''}`.toLowerCase().includes(q.toLowerCase()))
		.sort((a, b) => a.label.localeCompare(b.label));
	return (
		<Field label={label}>
			{(p) => <Combobox inputProps={p} value={value || ''} label={value && byId.get(value) ? byId.get(value).name : ''} options={options} placeholder="Search a manager…" emptyText="No eligible managers: add one to the tree first" onQuery={setQ} onOpen={() => setQ('')} onChange={(v) => onPick(v || null)} />}
		</Field>
	);
}

/** Selected employee: source-sheet facts (read-only) kept visibly apart from the structure settings. */
export default function NodeDetails({ employee, tree, byId, canEdit, onAssign, onRole, onRemove, onClose }) {
	const listId = useId();
	const node = tree[employee.id];
	const kids = childrenMap(tree, (id) => (byId.get(id) ? byId.get(id).name : id)).get(employee.id) || [];
	const sheetManager = employee.sheetManagerId ? byId.get(employee.sheetManagerId) : null;
	const sheetOk = sheetManager && tree[sheetManager.id] && (!node || node.parentId !== sheetManager.id) && canAssign(tree, employee.id, sheetManager.id).ok;
	const roles = [...new Set([...ROLE_SUGGESTIONS, ...[...byId.values()].map((e) => e.jobRole).filter(Boolean)])];
	return (
		<section className="rs-details" aria-label={`Details for ${employee.name}`}>
			<div className="rs-details__head">
				<EmployeeAvatar employee={employee} size={48} />
				<div>
					<h2>{employee.name}</h2>
					<p className="muted">{(node && node.roleLabel) || employee.jobRole || 'No role recorded'}</p>
				</div>
				<Button size="sm" variant="ghost" onClick={onClose} aria-label="Close details">
					Close
				</Button>
			</div>

			<h3>From the employee sheet</h3>
			<dl className="rs-facts">
				<Fact label="Employee ID" value={employee.code} />
				<Fact label="Role" value={employee.jobRole} />
				<Fact label="Department" value={employee.department} />
				<Fact label="Email" value={employee.email} />
				<Fact label="Status" value={employee.status} />
				<Fact label="Reports to (sheet)" value={sheetManager ? sheetManager.name : employee.sheetManagerId ? 'Not in this team' : null} />
			</dl>

			<h3>In this reporting structure</h3>
			{!node ? <p className="muted">Not placed yet.</p> : null}
			{canEdit ? (
				<>
					<ManagerPicker employee={employee} tree={tree} byId={byId} value={node ? node.parentId : null} label={node ? 'Manager' : 'Add under manager'} onPick={(id) => onAssign(employee.id, id)} />
					<div className="rs-details__row">
						{!node || node.parentId ? (
							<Button size="sm" onClick={() => onAssign(employee.id, null)}>
								{node ? 'Make top level' : 'Add as top level'}
							</Button>
						) : null}
						{sheetOk ? (
							<Button size="sm" onClick={() => onAssign(employee.id, sheetManager.id)}>
								Use sheet manager
							</Button>
						) : null}
						{node ? (
							<Button size="sm" variant="danger" onClick={() => onRemove(employee.id)}>
								Remove from tree
							</Button>
						) : null}
					</div>
					{node ? (
						<Field label="Role label in this structure" hint={`Optional. Shown instead of the sheet role; the sheet is not changed. Up to ${MAX_ROLE_LENGTH} characters.`}>
							{(p) => (
								<>
									<input {...p} list={listId} maxLength={MAX_ROLE_LENGTH} value={node.roleLabel || ''} placeholder={employee.jobRole || 'e.g. Developer'} onChange={(e) => onRole(employee.id, e.target.value)} />
									<datalist id={listId}>
										{roles.map((r) => (
											<option key={r} value={r} />
										))}
									</datalist>
								</>
							)}
						</Field>
					) : null}
				</>
			) : null}
			{node ? (
				<>
					<h3>Direct reports ({kids.length})</h3>
					{kids.length ? (
						<ul className="rs-reports">
							{kids.map((id) => (
								<li key={id}>
									{byId.get(id) ? byId.get(id).name : id}
									<small>{(tree[id].roleLabel || (byId.get(id) && byId.get(id).jobRole)) || ''}</small>
								</li>
							))}
						</ul>
					) : (
						<p className="muted">None</p>
					)}
				</>
			) : null}
		</section>
	);
}
