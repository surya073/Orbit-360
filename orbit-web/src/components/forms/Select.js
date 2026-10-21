import React, { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';

/** Flattens <option> children (also through fragments and arrays) into [{ value, label, disabled }]. */
function readOptions(children) {
	const out = [];
	const walk = (nodes) =>
		Children.forEach(nodes, (child) => {
			if (!isValidElement(child)) return;
			if (child.type === 'option') {
				const text = Children.toArray(child.props.children).join('');
				out.push({ value: child.props.value !== undefined ? String(child.props.value) : text, label: text, disabled: Boolean(child.props.disabled) });
			} else if (child.props && child.props.children) walk(child.props.children);
		});
	walk(children);
	return out;
}

/**
 * Drop-in replacement for a native <select> (same props: value, onChange, disabled, id, name, aria-*,
 * <option> children), drawn with the theme instead of the browser's own menu. ARIA 1.2 select-only
 * combobox: the trigger keeps focus while a listbox in a portal shows the options, so dialogs and
 * scrolling panels never clip it and focus traps keep working.
 *
 * Keyboard: Arrow keys, Home/End and type-ahead move; Enter or Space picks; Escape closes (and is
 * swallowed only while open); Tab leaves. onChange receives `{ target: { value, name, id } }`.
 */
export default function Select({ children, value, defaultValue, onChange, onKeyDown, onBlur, className = '', disabled, id, name, placeholder, defaultOpen = false, autoFocus, ...rest }) {
	const listId = useId();
	const options = readOptions(children);
	const [inner, setInner] = useState(defaultValue === undefined ? '' : String(defaultValue));
	const current = value === undefined ? inner : String(value);
	const [open, setOpen] = useState(defaultOpen);
	const [active, setActive] = useState(0);
	const [rect, setRect] = useState(null);
	const button = useRef(null);
	const list = useRef(null);
	const typed = useRef({ text: '', at: 0 });

	const selectedIndex = options.findIndex((o) => o.value === current);
	const shown = selectedIndex >= 0 ? options[selectedIndex] : value === undefined || current === '' ? options[0] : null;

	const measure = useCallback(() => {
		if (button.current) setRect(button.current.getBoundingClientRect());
	}, []);
	useLayoutEffect(() => {
		if (!open) return undefined;
		measure();
		// Escape closes the list wherever focus is (the trigger does not always hold it, e.g. after a pointer-only open).
		const escape = (e) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			setOpen(false);
		};
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', measure, true);
		document.addEventListener('keydown', escape);
		return () => {
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', measure, true);
			document.removeEventListener('keydown', escape);
		};
	}, [open, measure]);
	useEffect(() => {
		if (!open || !list.current) return;
		const el = list.current.children[active];
		if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
	}, [active, open, rect]);

	const openList = () => {
		if (disabled || open) return;
		setActive(Math.max(0, selectedIndex));
		setOpen(true);
	};
	const close = () => setOpen(false);
	const pick = (o) => {
		if (!o || o.disabled) return;
		if (value === undefined) setInner(o.value);
		if (onChange) onChange({ target: { value: o.value, name, id }, currentTarget: { value: o.value, name, id } });
		close();
	};
	const step = (from, dir) => {
		const n = options.length;
		for (let k = 1; k <= n; k++) {
			const i = (from + dir * k + n * 2) % n;
			if (!options[i].disabled) return i;
		}
		return from;
	};

	const handleKeyDown = (e) => {
		if (onKeyDown) onKeyDown(e);
		if (e.defaultPrevented || disabled) return;
		const k = e.key;
		if (k === 'ArrowDown' || k === 'ArrowUp') {
			e.preventDefault();
			if (!open) return openList();
			setActive((i) => step(i, k === 'ArrowDown' ? 1 : -1));
		} else if (k === 'Enter' || k === ' ') {
			if (open) {
				e.preventDefault(); // choosing must not submit the surrounding form
				pick(options[active]);
			} else if (k === ' ') {
				e.preventDefault();
				openList();
			}
		} else if (k === 'Escape') {
			if (open) {
				e.preventDefault();
				e.stopPropagation();
				close();
			}
		} else if (k === 'Home' || k === 'End') {
			e.preventDefault();
			if (!open) return openList();
			setActive(k === 'Home' ? step(-1, 1) : step(options.length, -1));
		} else if (k === 'Tab') {
			close();
		} else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			// type-ahead: letters typed in quick succession narrow the match
			const now = Date.now();
			const t = typed.current;
			t.text = now - t.at < 700 ? t.text + k.toLowerCase() : k.toLowerCase();
			t.at = now;
			const from = open ? active : selectedIndex;
			const order = options.map((_, i) => (from + (t.text.length === 1 ? 1 : 0) + i + options.length) % options.length);
			const hit = order.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(t.text));
			if (hit !== undefined) {
				if (open) setActive(hit);
				else pick(options[hit]);
			}
		}
	};

	const below = rect ? window.innerHeight - rect.bottom : 0;
	const flip = rect && below < 220 && rect.top > below;
	const label = shown ? shown.label : placeholder || '';
	const isPlaceholder = !shown || (shown.value === '' && options.length > 1);

	return (
		<>
			<button
				{...rest}
				ref={button}
				type="button"
				id={id}
				role="combobox"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
				className={`select ${open ? 'is-open' : ''} ${isPlaceholder ? 'is-placeholder' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
				disabled={disabled}
				autoFocus={autoFocus}
				data-value={current}
				onClick={() => (open ? close() : openList())}
				onKeyDown={handleKeyDown}
				onBlur={(e) => {
					close();
					if (onBlur) onBlur(e);
				}}
			>
				<span className="select__value">{label}</span>
				<Icon name="chevronDown" size={14} className="select__chevron" />
			</button>
			{open && rect
				? createPortal(
						<ul
							id={listId}
							ref={list}
							role="listbox"
							aria-label={rest['aria-label']}
							className={`combo__list select__list ${flip ? 'is-flipped' : ''}`.trim()}
							style={{ left: Math.min(rect.left, window.innerWidth - 12 - Math.max(rect.width, 160)), minWidth: Math.max(rect.width, 160), maxWidth: 'min(360px, calc(100vw - 24px))', ...(flip ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(300, rect.top - 12) } : { top: rect.bottom + 4, maxHeight: Math.min(300, below - 12) }) }}
							onMouseDown={(e) => e.preventDefault()}
						>
							{options.map((o, i) => (
								<li
									key={`${o.value}-${i}`}
									id={`${listId}-${i}`}
									role="option"
									data-value={o.value}
									aria-selected={i === selectedIndex}
									aria-disabled={o.disabled || undefined}
									className={`combo__opt ${i === active ? 'is-active' : ''} ${i === selectedIndex ? 'is-selected' : ''} ${o.disabled ? 'is-disabled' : ''}`.replace(/\s+/g, ' ').trim()}
									onMouseEnter={() => !o.disabled && setActive(i)}
									onClick={() => pick(o)}
								>
									<span>{o.label}</span>
									{i === selectedIndex ? <Icon name="check" size={14} /> : null}
								</li>
							))}
						</ul>,
						document.body
				  )
				: null}
		</>
	);
}
