import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import useOutsideClick from '../../hooks/useOutsideClick';

/**
 * Trigger + floating panel. `trigger({ open, toggle, props })` renders the control; spread
 * `props` onto it for aria wiring. The panel closes on outside click, Escape, or when children
 * call `close()`. `placement="up"` opens above the trigger (for controls at the bottom of the screen). Arrow keys move between `.menu-item`s.
 */
export default function Popover({ trigger, children, align = 'right', label, placement = 'down' }) {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);
	const id = useId();
	const close = useCallback(() => setOpen(false), []);
	useOutsideClick(ref, close, open);

	// The panel stays under its button; if it would run past a screen edge it is only nudged back inside.
	const panel = useRef(null);
	useLayoutEffect(() => {
		const el = panel.current;
		if (!open || !el) return;
		el.style.translate = '';
		const r = el.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		let dx = 0;
		if (r.right > vw - 8) dx = vw - 8 - r.right;
		if (r.left + dx < 8) dx = 8 - r.left;
		if (dx) el.style.translate = `${Math.round(dx)}px 0`;
	}, [open]);

	const onKeyDown = (e) => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		const items = [...ref.current.querySelectorAll('.popover .menu-item')];
		if (!items.length) return;
		e.preventDefault();
		const i = items.indexOf(document.activeElement);
		const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
		items[next].focus();
	};

	return (
		<div className="popover-wrap" ref={ref} onKeyDown={onKeyDown}>
			{trigger({ open, toggle: () => setOpen((o) => !o), props: { 'aria-haspopup': 'true', 'aria-expanded': open, 'aria-controls': open ? id : undefined } })}
			{open ? (
				<div id={id} ref={panel} className={`popover popover--${align}${placement === 'up' ? ' popover--up' : ''}`} role="group" aria-label={label}>
					{typeof children === 'function' ? children({ close }) : children}
				</div>
			) : null}
		</div>
	);
}
