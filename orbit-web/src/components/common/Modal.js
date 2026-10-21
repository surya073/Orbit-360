import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useScrollLock from '../../hooks/useScrollLock';
import { IconButton } from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: portal, focus trap, Esc to close, backdrop click, focus restored on
 * close. `footer` is rendered in a sticky action row.
 */
export default function Modal({ title, onClose, children, footer, size = 'md', dismissible = true }) {
	const titleId = useId();
	const ref = useRef(null);
	const returnTo = useRef(document.activeElement);
	const [closing, setClosing] = useState(false);

	// Closes after a short exit animation (immediately when reduced motion is preferred or unsupported).
	const close = useCallback(() => {
		const animate = window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!animate) return onClose();
		setClosing(true);
		setTimeout(onClose, 150);
	}, [onClose]);

	useEffect(() => {
		const node = ref.current;
		const first = node && node.querySelector('[data-autofocus],input,select,textarea,button');
		if (first) first.focus();
		else if (node) node.focus();
		const target = returnTo.current;
		return () => target && target.focus && target.focus();
	}, []);

	useScrollLock();

	const onKeyDown = (e) => {
		if (e.key === 'Escape' && dismissible) {
			e.stopPropagation();
			close();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = [...ref.current.querySelectorAll(FOCUSABLE)];
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};

	return createPortal(
		<div className={`modal-backdrop ${closing ? 'is-closing' : ''}`.trim()} onMouseDown={(e) => e.target === e.currentTarget && dismissible && close()}>
			<div ref={ref} className={`modal ${size === 'lg' ? 'modal--lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
				<div className="modal__head">
					<h2 id={titleId}>{title}</h2>
					{dismissible ? <IconButton icon="x" label="Close dialog" onClick={close} /> : null}
				</div>
				<div className="modal__body">{children}</div>
				{footer ? <div className="modal__foot">{footer}</div> : null}
			</div>
		</div>,
		document.body
	);
}
