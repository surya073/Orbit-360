import React, { useCallback, useId, useRef, useState } from 'react';
import useOutsideClick from '../../hooks/useOutsideClick';

/**
 * Trigger + floating panel. `trigger({ open, toggle, props })` renders the control; spread
 * `props` onto it for aria wiring. The panel closes on outside click, Escape, or when children
 * call `close()`. Arrow keys move between `.menu-item`s.
 */
export default function Popover({ trigger, children, align = 'right', label }) {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);
	const id = useId();
	const close = useCallback(() => setOpen(false), []);
	useOutsideClick(ref, close, open);

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
				<div id={id} className={`popover popover--${align}`} role="group" aria-label={label}>
					{typeof children === 'function' ? children({ close }) : children}
				</div>
			) : null}
		</div>
	);
}
