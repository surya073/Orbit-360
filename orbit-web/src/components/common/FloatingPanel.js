import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const EDGE = 8; // never closer to a screen edge than this

/**
 * A panel that hangs off a trigger. It is portalled to <body> (so no parent's overflow or stacking context can clip it)
 * and positioned from the trigger's own rectangle: under it, aligned to its right or left edge, flipped above when there
 * is no room below, nudged back inside the screen, and given a max height that scrolls inside. It follows the trigger
 * while the page or any scroller moves, closes when the trigger scrolls out of view, and closes on Escape or a press outside
 * both the panel and the trigger (focus returns to the trigger).
 */
export default function FloatingPanel({ anchorRef, open, onClose, align = 'right', width = 420, gap = 10, className = '', children, ...rest }) {
	const panel = useRef(null);
	const [pos, setPos] = useState(null);

	const place = useCallback(() => {
		const anchor = anchorRef.current;
		const el = panel.current;
		if (!anchor || !el) return;
		const a = anchor.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const vh = window.innerHeight;
		if (a.bottom < 0 || a.top > vh || a.right < 0 || a.left > vw) return onClose(); // the trigger left the screen
		const w = Math.min(width, vw - 2 * EDGE);
		const h = el.offsetHeight;
		let left = align === 'left' ? a.left : a.right - w;
		left = Math.max(EDGE, Math.min(left, vw - w - EDGE));
		const below = vh - a.bottom - gap - EDGE;
		const above = a.top - gap - EDGE;
		const flip = h > below && above > below;
		const room = flip ? above : below;
		const next = { left, width: w, maxHeight: Math.max(160, room), flip, ...(flip ? { bottom: vh - a.top + gap } : { top: a.bottom + gap }) };
		setPos((p) => (p && p.left === next.left && p.width === next.width && p.maxHeight === next.maxHeight && p.flip === next.flip && p.top === next.top && p.bottom === next.bottom ? p : next));
	}, [anchorRef, align, width, gap, onClose]);

	useLayoutEffect(() => {
		if (open) place();
		else setPos(null);
	}, [open, place]);

	useEffect(() => {
		if (!open) return undefined;
		let frame = 0;
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(place);
		};
		window.addEventListener('scroll', schedule, true); // capture: every scroller, not just the page
		window.addEventListener('resize', schedule);
		const down = (e) => {
			const t = e.target;
			if (panel.current && panel.current.contains(t)) return;
			if (anchorRef.current && anchorRef.current.contains(t)) return;
			onClose(e);
		};
		const key = (e) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			onClose(e);
			const a = anchorRef.current;
			if (a && a.focus) a.focus();
		};
		document.addEventListener('mousedown', down);
		document.addEventListener('touchstart', down, { passive: true });
		document.addEventListener('keydown', key);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule, true);
			window.removeEventListener('resize', schedule);
			document.removeEventListener('mousedown', down);
			document.removeEventListener('touchstart', down);
			document.removeEventListener('keydown', key);
		};
	}, [open, place, onClose, anchorRef]);

	if (!open) return null;
	const style = pos ? { position: 'fixed', zIndex: 'var(--z-popover)', overflowY: 'auto', ...pos } : { position: 'fixed', visibility: 'hidden', top: 0, left: 0, width: Math.min(width, document.documentElement.clientWidth - 2 * EDGE) };
	return createPortal(
		<div ref={panel} className={`floating ${pos && pos.flip ? 'is-flipped' : ''} ${className}`.replace(/\s+/g, ' ').trim()} style={style} {...rest}>
			{children}
		</div>,
		document.body
	);
}
