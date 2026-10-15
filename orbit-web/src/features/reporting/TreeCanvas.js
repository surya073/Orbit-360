import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { canAssign, childrenMap, fitView, hashIndex } from './treeModel';
import EmployeeAvatar from './EmployeeAvatar';

const NODE_W = 176;
const NODE_H = 132;
const MIN_K = 0.15;
const MAX_K = 2.2;
const ROLE_TONES = 6;

export const roleText = (employee, node) => (node && node.roleLabel) || employee.jobRole || null;

function TreeNode({ employee, node, pos, selected, dim, match, active, tree, childCount, collapsed, onToggle, onSelect, managerName }) {
	const drag = useDraggable({ id: `node:${employee.id}` });
	const verdict = active && active.id !== employee.id ? canAssign(tree, active.id, employee.id) : null;
	const drop = useDroppable({ id: `drop:${employee.id}`, disabled: !(verdict && verdict.ok) });
	const role = roleText(employee, node);
	const tone = role ? hashIndex(role.toLowerCase(), ROLE_TONES) + 1 : 0;
	const setRef = (el) => {
		drag.setNodeRef(el);
		drop.setNodeRef(el);
	};
	const cls = ['rs-node', selected && 'is-selected', dim && 'is-dim', match && 'is-match', drag.isDragging && 'is-dragging', drop.isOver && 'is-drop', verdict && !verdict.ok && 'is-blocked'].filter(Boolean).join(' ');
	return (
		<div
			ref={setRef}
			className={cls}
			style={{ left: pos.x - NODE_W / 2, top: pos.y - NODE_H / 2, width: NODE_W, height: NODE_H, '--rs-role': tone ? `var(--chart-${tone})` : 'var(--border-strong)' }}
			role="button"
			tabIndex={0}
			aria-pressed={selected}
			aria-label={`${employee.name}${role ? `, ${role}` : ''}${managerName ? `, reports to ${managerName}` : ', top level'}`}
			title={verdict && !verdict.ok ? verdict.reason : undefined}
			onClick={() => onSelect(employee.id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSelect(employee.id);
				}
			}}
			{...drag.attributes}
			{...drag.listeners}
		>
			<EmployeeAvatar employee={employee} size={60} />
			<span className="rs-node__name">{employee.name}</span>
			<span className="rs-node__role" title={role || 'No role recorded'}>
				{role || 'No role recorded'}
			</span>
			{drop.isOver ? <span className="rs-node__hint">Report to {employee.name}</span> : null}
			{childCount ? (
				<button
					type="button"
					className="rs-node__toggle"
					aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${employee.name}'s direct reports`}
					aria-expanded={!collapsed}
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onToggle(employee.id);
					}}
				>
					{collapsed ? `+${childCount}` : '−'}
				</button>
			) : null}
		</div>
	);
}

/**
 * Pan/zoom surface for the reporting tree. Nodes are absolutely positioned from the tidy layout
 * and joined by smooth curves drawn in one SVG. Pointer drag on empty space pans, the wheel zooms
 * around the cursor, and the keyboard works too (arrows pan, + / - zoom, 0 fits).
 */
const TreeCanvas = forwardRef(function TreeCanvas({ layout, tree, byId, selectedId, matches, active, collapsed, onToggle, onSelect, fitKey, empty }, ref) {
	const vp = useRef(null);
	const [box, setBox] = useState({ w: 800, h: 520 });
	const [view, setView] = useState({ k: 1, x: 24, y: 24 });
	const panning = useRef(null);
	const canvasDrop = useDroppable({ id: 'canvas' });
	const topDrop = useDroppable({ id: 'toplevel', disabled: !(active && active.kind === 'node') });

	useLayoutEffect(() => {
		const node = vp.current;
		if (!node) return undefined;
		const measure = () => setBox({ w: node.clientWidth || 800, h: node.clientHeight || 520 });
		measure();
		if (typeof ResizeObserver === 'undefined') return undefined;
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
	}, []);

	const fit = useCallback(() => setView(fitView(layout, box, { maxK: 1 })), [layout, box]);
	const reset = useCallback(() => setView({ k: 1, x: Math.max((box.w - layout.width) / 2, 24), y: 24 }), [box, layout.width]);
	const zoomAt = useCallback((factor, cx, cy) => {
		setView((v) => {
			const k = Math.min(Math.max(v.k * factor, MIN_K), MAX_K);
			const f = k / v.k;
			return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
		});
	}, []);
	useImperativeHandle(ref, () => ({ fit, reset, zoomIn: () => zoomAt(1.2, box.w / 2, box.h / 2), zoomOut: () => zoomAt(1 / 1.2, box.w / 2, box.h / 2), zoom: () => view.k }), [fit, reset, zoomAt, box, view.k]);

	// Fit when a new structure loads (fitKey changes), not on every edit.
	useEffect(() => {
		if (fitKey !== undefined) fit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fitKey, box.w, box.h]);

	useEffect(() => {
		const node = vp.current;
		if (!node) return undefined;
		const onWheel = (e) => {
			e.preventDefault();
			const r = node.getBoundingClientRect();
			zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	}, [zoomAt]);

	const onPointerDown = (e) => {
		if (e.button !== 0 || (e.target.closest && e.target.closest('.rs-node, .rs-canvas__tools, .rs-topdrop'))) return;
		panning.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e) => {
		const p = panning.current;
		if (p) setView((v) => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y }));
	};
	const endPan = () => {
		panning.current = null;
	};
	const onKeyDown = (e) => {
		if (e.target !== e.currentTarget) return;
		const step = 48;
		if (e.key === 'ArrowLeft') setView((v) => ({ ...v, x: v.x + step }));
		else if (e.key === 'ArrowRight') setView((v) => ({ ...v, x: v.x - step }));
		else if (e.key === 'ArrowUp') setView((v) => ({ ...v, y: v.y + step }));
		else if (e.key === 'ArrowDown') setView((v) => ({ ...v, y: v.y - step }));
		else if (e.key === '+' || e.key === '=') zoomAt(1.2, box.w / 2, box.h / 2);
		else if (e.key === '-') zoomAt(1 / 1.2, box.w / 2, box.h / 2);
		else if (e.key === '0') fit();
		else return;
		e.preventDefault();
	};

	const paths = useMemo(
		() =>
			layout.edges.map(({ from, to }) => {
				const a = layout.pos.get(from);
				const b = layout.pos.get(to);
				const y1 = a.y + NODE_H / 2;
				const y2 = b.y - NODE_H / 2;
				const mid = (y1 + y2) / 2;
				return { key: `${from}-${to}`, from, to, d: `M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}` };
			}),
		[layout]
	);
	const kids = useMemo(() => childrenMap(tree), [tree]);
	const linked = (e) => selectedId && (e.from === selectedId || e.to === selectedId);

	return (
		<div
			className={`rs-canvas ${canvasDrop.isOver && active && active.kind === 'emp' ? 'is-drop' : ''}`.trim()}
			ref={(el) => {
				vp.current = el;
				canvasDrop.setNodeRef(el);
			}}
			tabIndex={0}
			role="application"
			aria-label="Reporting tree. Drag to pan, scroll to zoom. Arrow keys pan, plus and minus zoom, zero fits the screen."
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endPan}
			onPointerCancel={endPan}
			onKeyDown={onKeyDown}
		>
			{empty}
			{active && active.kind === 'node' ? (
				<div ref={topDrop.setNodeRef} className={`rs-topdrop ${topDrop.isOver ? 'is-over' : ''}`.trim()}>
					Drop here to make this employee top level
				</div>
			) : null}
			<div className="rs-stage" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: layout.width, height: layout.height }}>
				<svg className="rs-edges" width={layout.width} height={layout.height} aria-hidden="true">
					{paths.map((p) => (
						<path key={p.key} d={p.d} className={`rs-edge ${linked(p) ? 'is-linked' : ''}`.trim()} />
					))}
				</svg>
				{[...layout.pos.entries()].map(([id, pos]) => {
					const employee = byId.get(id);
					if (!employee) return null;
					const node = tree[id];
										return (
						<TreeNode
							key={id}
							employee={employee}
							node={node}
							pos={pos}
							selected={selectedId === id}
							dim={Boolean(matches) && !matches.has(id)}
							match={Boolean(matches) && matches.has(id)}
							active={active}
							tree={tree}
							childCount={(kids.get(id) || []).length}
							collapsed={collapsed.has(id)}
							onToggle={onToggle}
							onSelect={onSelect}
							managerName={node && node.parentId && byId.get(node.parentId) ? byId.get(node.parentId).name : null}
						/>
					);
				})}
			</div>
			<span className="rs-zoom" aria-hidden="true">
				{Math.round(view.k * 100)}%
			</span>
		</div>
	);
});

export default TreeCanvas;
export { NODE_W, NODE_H };
