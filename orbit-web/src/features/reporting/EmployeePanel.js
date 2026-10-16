import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import Button from '../../components/common/Button';
import Field from '../../components/forms/Field';
import { Checkbox } from '../../components/forms/Choice';
import EmployeeAvatar from './EmployeeAvatar';
import { roleText } from './TreeCanvas';
import Select from '../../components/forms/Select';

function PanelCard({ employee, node, selected, onSelect, onAdd }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `emp:${employee.id}` });
	const role = roleText(employee, node);
	return (
		<li className={`rs-emp ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`.trim()}>
			<div ref={setNodeRef} className="rs-emp__main" role="button" tabIndex={0} aria-pressed={selected} onClick={() => onSelect(employee.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(employee.id))} {...attributes} {...listeners}>
				<EmployeeAvatar employee={employee} size={36} />
				<span className="rs-emp__text">
					<strong>{employee.name}</strong>
					<small>{[role || 'No role recorded', employee.code].filter(Boolean).join(' · ')}</small>
				</span>
			</div>
			{node ? (
				<span className="chip rs-emp__placed">In tree</span>
			) : (
				<Button size="sm" onClick={() => onAdd(employee.id)} aria-label={`Add ${employee.name} to the tree as top level`}>
					Add
				</Button>
			)}
		</li>
	);
}

/** Left-hand roster: real employees from the sheet. Searchable, filterable, draggable; also the drop zone that removes a node. */
export default function EmployeePanel({ employees, tree, query, onQuery, role, onRole, dept, onDept, showAll, onShowAll, selectedId, onSelect, onAdd, dragging }) {
	const drop = useDroppable({ id: 'panel', disabled: !(dragging && dragging.kind === 'node') });
	const roles = [...new Set(employees.map((e) => (tree[e.id] && tree[e.id].roleLabel) || e.jobRole).filter(Boolean))].sort((a, b) => a.localeCompare(b));
	const depts = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();
	const q = query.trim().toLowerCase();
	const rows = employees.filter((e) => {
		if (!showAll && tree[e.id]) return false;
		const r = (tree[e.id] && tree[e.id].roleLabel) || e.jobRole || '';
		if (role && r !== role) return false;
		if (dept && e.department !== dept) return false;
		return !q || [e.name, e.jobRole, tree[e.id] && tree[e.id].roleLabel, e.department, e.code, e.email].some((v) => v && String(v).toLowerCase().includes(q));
	});
	const unmapped = employees.filter((e) => !tree[e.id]).length;
	return (
		<aside ref={drop.setNodeRef} className={`rs-panel ${drop.isOver ? 'is-drop' : ''}`.trim()} aria-label="Employees">
			<div className="rs-panel__head">
				<h2>Employees</h2>
				<span className="chip" role="status">
					{unmapped === 0 ? 'All placed' : `${unmapped} not placed`}
				</span>
			</div>
			<Field label="Search employees">{(p) => <input {...p} type="search" value={query} placeholder="Name, role, department or ID" onChange={(e) => onQuery(e.target.value)} />}</Field>
			<div className="rs-panel__filters">
				<Field label="Role">
					{(p) => (
						<Select {...p} value={role} onChange={(e) => onRole(e.target.value)}>
							<option value="">All roles</option>
							{roles.map((r) => (
								<option key={r}>{r}</option>
							))}
						</Select>
					)}
				</Field>
				{depts.length > 1 ? (
					<Field label="Department">
						{(p) => (
							<Select {...p} value={dept} onChange={(e) => onDept(e.target.value)}>
								<option value="">All</option>
								{depts.map((d) => (
									<option key={d}>{d}</option>
								))}
							</Select>
						)}
					</Field>
				) : null}
			</div>
			<Checkbox checked={showAll} onChange={(e) => onShowAll(e.target.checked)} label="Include employees already in the tree" />
			{drop.isOver ? <p className="rs-panel__drop">Release to remove from the tree. The employee record is not deleted.</p> : null}
			<ul className="rs-panel__list">
				{rows.map((e) => (
					<PanelCard key={e.id} employee={e} node={tree[e.id]} selected={selectedId === e.id} onSelect={onSelect} onAdd={onAdd} />
				))}
			</ul>
			{rows.length === 0 ? <p className="muted rs-panel__none">{employees.length === 0 ? 'This team has no active employees.' : unmapped === 0 && !showAll ? 'Every employee is in the tree.' : 'No employees match.'}</p> : null}
		</aside>
	);
}
