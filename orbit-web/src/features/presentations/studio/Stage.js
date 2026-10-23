import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SlideCanvas from './SlideCanvas';
import { CANVAS_H, CANVAS_W, FONT_STACKS, colorCss, moveObject, resizeObject } from './slideModel';

/**
 * The editing surface for one slide: the real slide canvas, scaled to fit, with a transparent layer on top that carries
 * selection, dragging, resizing, snapping guides and in-place text editing. Everything on the layer is in canvas units
 * (1920 x 1080) and scaled together with the slide, so pointer movements are divided by the scale to get canvas units.
 */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const SNAP = 8; // screen pixels

/** Snaps a moving box to the slide's edges and centre lines and to the other objects; returns the box and the guides to draw. */
export function snapBox(box, others, scale, resizing = false) {
	const t = SNAP / scale;
	const xs = [0, CANVAS_W / 2, CANVAS_W];
	const ys = [0, CANVAS_H / 2, CANVAS_H];
	others.forEach((o) => {
		xs.push(o.x, o.x + o.w / 2, o.x + o.w);
		ys.push(o.y, o.y + o.h / 2, o.y + o.h);
	});
	const guides = [];
	let { x, y, w, h } = box;
	const fit = (points, list) => {
		let best = null;
		for (const p of points) for (const c of list) if (Math.abs(p.v - c) <= t && (!best || Math.abs(p.v - c) < Math.abs(best.d))) best = { d: c - p.v, at: c, kind: p.k };
		return best;
	};
	const bx = fit(resizing ? [{ v: x + w, k: 'r' }] : [{ v: x, k: 'l' }, { v: x + w / 2, k: 'c' }, { v: x + w, k: 'r' }], xs);
	const by = fit(resizing ? [{ v: y + h, k: 'b' }] : [{ v: y, k: 't' }, { v: y + h / 2, k: 'm' }, { v: y + h, k: 'b' }], ys);
	if (bx) {
		if (resizing) w += bx.d;
		else x += bx.d;
		guides.push({ orient: 'v', pos: bx.at });
	}
	if (by) {
		if (resizing) h += by.d;
		else y += by.d;
		guides.push({ orient: 'h', pos: by.at });
	}
	return { box: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, guides };
}

export default function Stage({ slide, theme, selectedId, onSelect, onChangeObject, editingId, setEditingId, renderWidget }) {
	const wrapRef = useRef(null);
	const layerRef = useRef(null);
	const [scale, setScale] = useState(0.5);
	const [guides, setGuides] = useState([]);
	const drag = useRef(null);
	const lastDown = useRef(null); // the object last pressed: pointer capture sends the double-click to the layer, so it is found from here

	useLayoutEffect(() => {
		const node = wrapRef.current;
		if (!node) return undefined;
		const fit = () => setScale(Math.max(0.1, Math.min((node.clientWidth - 8) / CANVAS_W, (node.clientHeight - 8) / CANVAS_H)));
		fit();
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
		if (ro) ro.observe(node);
		window.addEventListener('resize', fit);
		return () => {
			if (ro) ro.disconnect();
			window.removeEventListener('resize', fit);
		};
	}, []);

	const objects = useMemo(() => slide.objects || [], [slide.objects]);
	const selected = objects.find((o) => o.id === selectedId) || null;

	const begin = (e, o, mode, handle) => {
		if (e.button !== 0) return;
		e.stopPropagation();
		if (editingId && editingId !== o.id) setEditingId(null);
		onSelect(o.id);
		lastDown.current = o.id;
		drag.current = { id: o.id, mode, handle, x0: e.clientX, y0: e.clientY, orig: { ...o }, moved: false };
		if (layerRef.current.setPointerCapture) layerRef.current.setPointerCapture(e.pointerId);
	};
	const move = useCallback(
		(e) => {
			const d = drag.current;
			if (!d) return;
			const dx = (e.clientX - d.x0) / scale;
			const dy = (e.clientY - d.y0) / scale;
			if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3 / scale) return;
			d.moved = true;
			const others = objects.filter((o) => o.id !== d.id);
			let next;
			if (d.mode === 'move') {
				const free = moveObject(d.orig, dx, dy);
				const s = e.altKey ? { box: free, guides: [] } : snapBox(free, others, scale);
				next = { x: s.box.x, y: s.box.y };
				setGuides(s.guides);
			} else {
				const free = resizeObject(d.orig, d.handle, dx, dy, e.shiftKey || d.orig.kind === 'image');
				let box = { x: free.x, y: free.y, w: free.w, h: free.h };
				let g = [];
				if (!e.altKey && (d.handle.includes('e') || d.handle.includes('s'))) {
					const s = snapBox(free, others, scale, true); // only the edge being dragged snaps
					box = { x: free.x, y: free.y, w: d.handle.includes('e') ? s.box.w : free.w, h: d.handle.includes('s') ? s.box.h : free.h };
					g = s.guides;
				}
				next = { x: box.x, y: box.y, w: Math.max(24, box.w), h: Math.max(24, box.h) };
				setGuides(g);
			}
			onChangeObject(d.id, next, `drag-${d.id}`);
		},
		[objects, scale, onChangeObject]
	);
	const end = useCallback((e) => {
		const d = drag.current;
		drag.current = null;
		setGuides([]);
		const el = layerRef.current;
		if (d && el && el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}, []);

	const editing = objects.find((o) => o.id === editingId && (o.kind === 'text' || o.kind === 'button'));
	const handleSize = 14 / scale;

	return (
		<div className="stage" ref={wrapRef}>
			<div className="stage__frame" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
				<div className="stage__scaled pscope" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, ...theme.style }} data-ptheme={theme.id} data-pscheme={theme.dark ? 'dark' : 'light'}>
					<div className="stage__paper">
						<SlideCanvas slide={slide} animate={false} editing hiddenId={editing ? editing.id : null} renderWidget={renderWidget} />
					</div>
					<div
						ref={layerRef}
						className="stage__layer"
						role="application"
						aria-label="Slide editing area"
						tabIndex={0}
						onPointerDown={() => {
							lastDown.current = null;
							onSelect(null);
							setEditingId(null);
						}}
						onDoubleClick={() => {
							const o = objects.find((x) => x.id === lastDown.current);
							if (o && (o.kind === 'text' || o.kind === 'button')) setEditingId(o.id);
						}}
						onPointerMove={move}
						onPointerUp={end}
						onPointerCancel={end}
					>
						{objects.map((o) => (
							<div
								key={o.id}
								className={`stage__hit ${o.id === selectedId ? 'is-selected' : ''}`}
								style={{ left: o.x, top: o.y, width: o.w, height: o.h, transform: o.rot ? `rotate(${o.rot}deg)` : undefined, outlineWidth: 2 / scale }}
								onPointerDown={(e) => begin(e, o, 'move')}
								data-oid={o.id}
								data-testid={`hit-${o.id}`}
							>
								{o.anim && o.anim.step > 0 ? (
									<span className="stage__badge" style={{ fontSize: (22 / scale) * 0.55, padding: `${4 / scale}px ${10 / scale}px` }} title="Appears on this click">
										click {o.anim.step}
									</span>
								) : null}
							</div>
						))}
						{selected && !editing ? (
							<div className="stage__box" style={{ left: selected.x, top: selected.y, width: selected.w, height: selected.h, transform: selected.rot ? `rotate(${selected.rot}deg)` : undefined, borderWidth: 2 / scale }}>
								{HANDLES.map((h) => (
									<i
										key={h}
										className={`stage__handle stage__handle--${h}`}
										style={{ width: handleSize, height: handleSize, cursor: CURSOR[h], borderWidth: 2 / scale, ...handlePos(h, handleSize) }}
										onPointerDown={(e) => begin(e, selected, 'resize', h)}
										aria-hidden="true"
									/>
								))}
							</div>
						) : null}
						{guides.map((g, i) => (
							<span key={i} className={`stage__guide stage__guide--${g.orient}`} style={g.orient === 'v' ? { left: g.pos, width: 2 / scale } : { top: g.pos, height: 2 / scale }} />
						))}
						{editing ? (
							<textarea
								className="stage__editor"
								autoFocus
								aria-label="Edit text"
								value={editing.text || ''}
								style={{
									left: editing.x,
									top: editing.y,
									width: editing.w,
									height: editing.h,
									transform: editing.rot ? `rotate(${editing.rot}deg)` : undefined,
									fontSize: editing.st.fs ?? 40,
									fontWeight: editing.st.fw ?? 500,
									fontStyle: editing.st.it ? 'italic' : undefined,
									textAlign: editing.st.al || 'left',
									color: colorCss(editing.st.color, 'var(--text)'),
									fontFamily: FONT_STACKS[editing.st.ff] || undefined,
									lineHeight: editing.st.lh ?? 1.2,
									letterSpacing: editing.st.ls ? `${editing.st.ls}px` : undefined,
									background: editing.kind === 'button' ? colorCss(editing.st.fill, 'var(--accent)') : 'transparent',
									borderRadius: editing.kind === 'button' ? editing.st.r ?? 999 : 0,
									paddingTop: editing.kind === 'button' ? Math.max(0, (editing.h - (editing.st.fs ?? 40) * (editing.st.lh ?? 1.2)) / 2) : 0,
									outlineWidth: 3 / scale,
								}}
								onFocus={(e) => e.target.select()} /* typing replaces the text that is there (a new box starts with a hint) */
								onChange={(e) => onChangeObject(editing.id, { text: e.target.value }, `text-${editing.id}`)}
								onKeyDown={(e) => {
									e.stopPropagation();
									if (e.key === 'Escape') setEditingId(null);
								}}
								onBlur={() => setEditingId(null)}
								onPointerDown={(e) => e.stopPropagation()}
							/>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

function handlePos(h, size) {
	const half = -size / 2;
	const pos = {};
	if (h.includes('n')) pos.top = half;
	if (h.includes('s')) pos.bottom = half;
	if (h.includes('w')) pos.left = half;
	if (h.includes('e')) pos.right = half;
	if (h === 'n' || h === 's') pos.left = `calc(50% - ${size / 2}px)`;
	if (h === 'e' || h === 'w') pos.top = `calc(50% - ${size / 2}px)`;
	return pos;
}
