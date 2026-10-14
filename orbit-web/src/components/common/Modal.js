import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
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

	useEffect(() => {
		const node = ref.current;
		const first = node && node.querySelector('[data-autofocus],input,select,textarea,button');
		if (first) first.focus();
		else if (node) node.focus();
		const target = returnTo.current;
		return () => target && target.focus && target.focus();
	}, []);

	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	const onKeyDown = (e) => {
		if (e.key === 'Escape' && dismissible) {
			e.stopPropagation();
			onClose();
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
		<div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose()}>
			<div ref={ref} className={`modal ${size === 'lg' ? 'modal--lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
				<div className="modal__head">
					<h2 id={titleId}>{title}</h2>
					{dismissible ? <IconButton icon="x" label="Close dialog" onClick={onClose} /> : null}
				</div>
				<div className="modal__body">{children}</div>
				{footer ? <div className="modal__foot">{footer}</div> : null}
			</div>
		</div>,
		document.body
	);
}
