import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import Button from '../../components/common/Button';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { useToast } from '../../components/feedback/ToastProvider';
import PageHeader from '../../components/layout/PageHeader';
import { ROUTES } from '../../config/routes';
import useApiResource from '../../hooks/useApiResource';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { reportingService } from '../../services/reportingService';
import { resourceService } from '../../services/resourceService';
import EmployeeAvatar from './EmployeeAvatar';
import EmployeePanel from './EmployeePanel';
import NodeDetails from './NodeDetails';
import TreeCanvas, { NODE_H, NODE_W, roleText } from './TreeCanvas';
import { ancestorsOf, assign, canAssign, layoutTree, nodesFromTree, removeNode, seedFromSheet, setRole, sheetLinkCount, treeFromNodes, treeStats } from './treeModel';
import useTreeHistory from './useTreeHistory';
import Select from '../../components/forms/Select';

/** Drop priority: a person beats the "top level" strip, which beats the roster, which beats the empty canvas. */
function collide(args) {
	const hits = pointerWithin(args);
	for (const prefix of ['drop:', 'toplevel', 'panel', 'canvas']) {
		const found = hits.filter((h) => String(h.id).startsWith(prefix));
		if (found.length) return [found[0]];
	}
	return [];
}

const errorText = (err) => {
	const d = Array.isArray(err.details) ? err.details.map((x) => x.message).filter(Boolean) : [];
	return d.length ? `${err.message}: ${d.join(' ')}` : err.message;
};

/**
 * Reporting Structure builder (Employees -> Reporting structure). Everything is edited in local
 * state; nothing is sent until Save. The structure lives per team, in its own storage, and never
 * changes the employee source records.
 */
export default function ReportingBuilderPage() {
	const { user, can } = useAuth();
	const canEditTree = can('reporting.edit'); // View only without it: nothing can be placed, moved, renamed or saved
	const { notify } = useToast();
	const [sp, setSp] = useSearchParams();
	const isAdmin = user.role === 'admin';
	const teams = useApiResource((signal) => resourceService.list('teams', { pageSize: 100 }, { signal }), 'rs-teams', { enabled: isAdmin && can('teams.view'), isEmpty: () => false });
	const teamId = isAdmin ? sp.get('team') || (teams.data && teams.data[0] ? String(teams.data[0].ROWID) : '') : String(user.teamId || '');
	const res = useApiResource((signal) => reportingService.get(teamId, { signal }), `rs|${teamId}`, { enabled: Boolean(teamId), isEmpty: () => false });

	const hist = useTreeHistory();
	const { tree } = hist;
	const [fitKey, setFitKey] = useState(0);
	const [selectedId, setSelectedId] = useState(null);
	const [query, setQuery] = useState('');
	const [roleFilter, setRoleFilter] = useState('');
	const [deptFilter, setDeptFilter] = useState('');
	const [showAll, setShowAll] = useState(false);
	const [collapsed, setCollapsed] = useState(() => new Set());
	const [active, setActive] = useState(null);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState(null); // { tone, text }
	const canvas = useRef(null);

	const employees = useMemo(() => (res.data ? res.data.employees : []), [res.data]);
	const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
	const nameOf = useCallback((id) => (byId.get(id) ? byId.get(id).name : id), [byId]);

	useEffect(() => {
		if (!res.data) return;
		hist.load(treeFromNodes(res.data.nodes));
		setCollapsed(new Set());
		setSelectedId(null);
		setNotice(null);
		setFitKey((k) => k + 1);
	}, [res.data]); // eslint-disable-line react-hooks/exhaustive-deps
	useUnsavedGuard(hist.dirty);

	const q = query.trim().toLowerCase();
	const matches = useMemo(() => {
		if (!q) return null;
		return new Set(Object.keys(tree).filter((id) => byId.has(id) && [byId.get(id).name, byId.get(id).jobRole, tree[id].roleLabel, byId.get(id).department, byId.get(id).code].some((v) => v && String(v).toLowerCase().includes(q))));
	}, [q, tree, byId]);
	// A search reveals matches inside collapsed branches without forgetting the user's collapse choices.
	const effectiveCollapsed = useMemo(() => {
		if (!matches || !matches.size) return collapsed;
		const open = new Set([...matches].flatMap((id) => ancestorsOf(tree, id)));
		return new Set([...collapsed].filter((id) => !open.has(id)));
	}, [collapsed, matches, tree]);

	const layout = useMemo(() => layoutTree(tree, { nameOf, nodeW: NODE_W, nodeH: NODE_H, gapX: 28, gapY: 64, collapsed: effectiveCollapsed }), [tree, nameOf, effectiveCollapsed]);
	const stats = useMemo(() => treeStats(tree, employees.length), [tree, employees.length]);
	const seedable = useMemo(() => sheetLinkCount(employees), [employees]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }));

	const place = useCallback(
		(id, parentId) => {
			if (!canEditTree) return;
			const check = canAssign(tree, id, parentId);
			if (!check.ok) {
				setNotice({ tone: 'error', text: check.reason });
				return;
			}
			setNotice(null);
			hist.apply((t) => assign(t, id, parentId));
			setSelectedId(id);
		},
		[tree, hist, canEditTree]
	);
	const remove = useCallback(
		(id) => {
			if (!canEditTree) return;
			hist.apply((t) => removeNode(t, id));
			setNotice({ tone: 'info', text: `${nameOf(id)} was removed from the tree. Their direct reports moved up one level. The employee record is unchanged.` });
		},
		[hist, nameOf, canEditTree]
	);
	const editRole = useCallback((id, label) => canEditTree && hist.apply((t) => setRole(t, id, label), `role:${id}`), [hist, canEditTree]);

	const onDragStart = (e) => {
		if (!canEditTree) return;
		const [kind, id] = String(e.active.id).split(':');
		setActive({ kind: kind === 'emp' ? 'emp' : 'node', id });
		setNotice(null);
	};
	const onDragEnd = (e) => {
		const a = active;
		setActive(null);
		if (!a || !e.over) return;
		const over = String(e.over.id);
		if (over.startsWith('drop:')) place(a.id, over.slice(5));
		else if (over === 'toplevel' && a.kind === 'node') place(a.id, null);
		else if (over === 'canvas' && a.kind === 'emp') place(a.id, null);
		else if (over === 'panel' && a.kind === 'node') remove(a.id);
		// anything else (e.g. a placed node dropped on empty canvas) changes nothing
	};

	const toggle = useCallback((id) => setCollapsed((s) => {
		const n = new Set(s);
		if (n.has(id)) n.delete(id);
		else n.add(id);
		return n;
	}), []);
	const parents = useMemo(() => new Set(Object.values(tree).map((n) => n.parentId).filter((p) => p && tree[p])), [tree]);
	const allCollapsed = parents.size > 0 && [...parents].every((p) => collapsed.has(p));

	const save = async () => {
		setSaving(true);
		setNotice(null);
		try {
			await reportingService.save(teamId, nodesFromTree(tree));
			hist.markSaved(tree);
			notify('Reporting structure saved');
			setNotice({ tone: 'success', text: 'Saved. The Team Reporting Structure slide in presentations now uses this tree.' });
		} catch (err) {
			setNotice({ tone: 'error', text: `Not saved: ${errorText(err)}` });
		} finally {
			setSaving(false);
		}
	};

	const selected = selectedId ? byId.get(selectedId) : null;
	const dragEmployee = active ? byId.get(active.id) : null;
	const teamName = res.data ? res.data.team.name : '';

	const empty = !stats.mapped ? (
		<div className="rs-empty">
			<h2>No reporting relationships yet</h2>
			<p>Drag an employee from the list onto this canvas to place the top-level leader, then drag others onto their manager. You can also use the Add button or the manager picker.</p>
			{seedable > 0 ? (
				<Button
					onClick={() => {
						hist.apply(() => seedFromSheet(employees));
						setFitKey((k) => k + 1);
					}}
				>
					Start from the sheet&apos;s “Reports to” ({seedable})
				</Button>
			) : null}
		</div>
	) : null;

	let body;
	if (isAdmin && teams.status === 'loading' && !teams.data) body = <LoadingState lines={4} label="Loading teams" />;
	else if (!teamId) body = <p className="banner banner--warning">{isAdmin ? 'There are no teams yet. Create a team first: reporting structures are kept per team.' : 'Your account is not assigned to a team.'}</p>;
	else if (res.status === 'loading' && !res.data) body = <LoadingState lines={6} label="Loading employees and the saved structure" />;
	else if (res.status === 'error') body = <ErrorState error={res.error} onRetry={res.reload} />;
	else
		body = (
			<DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
				<div className="rs-toolbar" role="toolbar" aria-label="Reporting structure actions">
					<Button variant="primary" onClick={save} loading={saving} disabled={!hist.dirty}>
						Save structure
					</Button>
					<Button onClick={hist.undo} disabled={!hist.canUndo}>
						Undo
					</Button>
					<Button onClick={hist.redo} disabled={!hist.canRedo}>
						Redo
					</Button>
					<span className="rs-toolbar__sep" />
					<Button onClick={() => canvas.current && canvas.current.zoomOut()} aria-label="Zoom out">
						−
					</Button>
					<Button onClick={() => canvas.current && canvas.current.zoomIn()} aria-label="Zoom in">
						+
					</Button>
					<Button onClick={() => canvas.current && canvas.current.fit()}>Fit to screen</Button>
					<Button onClick={() => canvas.current && canvas.current.reset()}>Reset view</Button>
					<Button onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(parents))} disabled={!parents.size}>
						{allCollapsed ? 'Expand all' : 'Collapse all'}
					</Button>
					<span className="rs-toolbar__spacer" />
					{hist.dirty ? <span className="chip chip--warn">Unsaved changes</span> : <span className="chip">All changes saved</span>}
					<span className="chip">{stats.mapped} placed</span>
					<span className="chip">{stats.levels} {stats.levels === 1 ? 'level' : 'levels'}</span>
					<span className="chip">{stats.roots} top-level</span>
				</div>
				{notice ? (
					<p role={notice.tone === 'error' ? 'alert' : 'status'} className={`banner banner--${notice.tone === 'error' ? 'error' : notice.tone === 'success' ? 'success' : 'info'}`}>
						{notice.text}
					</p>
				) : null}
				{res.data && res.data.truncated ? <p className="banner banner--warning">This team has more employees than can be listed at once (300). Only the first 300, in name order, are available here.</p> : null}
				{stats.mapped > 0 && stats.unmapped > 0 ? (
					<p className="banner banner--info" role="note">
						{stats.unmapped} {stats.unmapped === 1 ? 'employee has' : 'employees have'} not been placed yet. Partial structures are fine; they are listed on the left so you can finish progressively.
					</p>
				) : null}
				{!canEditTree ? (
					<p className="banner banner--info" role="note">
						You can view this reporting structure but not change it.
					</p>
				) : null}
				<div className="rs-layout">
					<EmployeePanel
						employees={employees}
						tree={tree}
						query={query}
						onQuery={setQuery}
						role={roleFilter}
						onRole={setRoleFilter}
						dept={deptFilter}
						onDept={setDeptFilter}
						showAll={showAll}
						onShowAll={setShowAll}
						selectedId={selectedId}
						onSelect={setSelectedId}
						onAdd={(id) => place(id, null)}
						dragging={active}
					/>
					<TreeCanvas ref={canvas} layout={layout} tree={tree} byId={byId} selectedId={selectedId} matches={matches} active={active} collapsed={effectiveCollapsed} onToggle={toggle} onSelect={setSelectedId} fitKey={fitKey} empty={empty} />
					{selected ? <NodeDetails key={selected.id} employee={selected} tree={tree} byId={byId} canEdit={canEditTree} onAssign={place} onRole={editRole} onRemove={remove} onClose={() => setSelectedId(null)} /> : null}
				</div>
				<DragOverlay dropAnimation={null}>
					{dragEmployee ? (
						<div className="rs-ghost">
							<EmployeeAvatar employee={dragEmployee} size={36} />
							<span>
								<strong>{dragEmployee.name}</strong>
								<small>{roleText(dragEmployee, tree[dragEmployee.id]) || 'No role recorded'}</small>
							</span>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		);

	return (
		<div className="rs-page">
			<PageHeader
				title="Reporting structure"
				description={teamName ? `Who reports to whom in ${teamName}. Used by the Team Reporting Structure presentation slide.` : 'Who reports to whom. Used by the Team Reporting Structure presentation slide.'}
				actions={
					<>
						{isAdmin && teams.data ? (
							<label className="rs-teampick">
								<span>Team</span>
								<Select
									value={teamId}
									onChange={(e) => {
										if (hist.dirty && !window.confirm('You have unsaved changes. Switch team and discard them?')) return;
										setSp({ team: e.target.value });
									}}
								>
									{teams.data.map((t) => (
										<option key={t.ROWID} value={t.ROWID}>
											{t.name}
										</option>
									))}
								</Select>
							</label>
						) : null}
						<Button to={ROUTES.employees}>Back to employees</Button>
					</>
				}
			/>
			{body}
		</div>
	);
}
