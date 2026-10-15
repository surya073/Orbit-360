import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';

/**
 * Searchable dropdown (ARIA 1.2 combobox with a listbox popup). One text field does both jobs:
 * it shows the selected label, and typing filters the options (the owner decides how, e.g. a
 * server-side search via `onQuery`). Keyboard: Arrow keys move, Enter picks, Escape closes (and is
 * swallowed only while open, so it still closes a surrounding dialog otherwise), Tab leaves.
 *
 * The popup renders in a portal with fixed positioning so dialogs and scrolling panels never clip
 * it, and it never takes focus, so surrounding focus traps keep working.
 *
 * options: [{ value, label, detail? }]   value/label: the current selection ('' = none)
 */
export default function Combobox({ value, label, options, loading, error, placeholder = 'Search or select…', disabled, clearable = true, emptyText = 'No matches', onQuery, onOpen, onChange, inputProps = {} }) {
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const [rect, setRect] = useState(null);
	const wrap = useRef(null);
	const input = useRef(null);
	const list = useRef(null);

	const measure = useCallback(() => {
		if (wrap.current) setRect(wrap.current.getBoundingClientRect());
	}, []);
	useLayoutEffect(() => {
		if (!open) return undefined;
		measure();
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', measure, true);
		return () => {
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', measure, true);
		};
	}, [open, measure]);

	// Keep the highlighted option in view as the arrows move through a long list.
	useEffect(() => {
		if (!open || !list.current) return;
		const el = list.current.children[active];
		if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
	}, [active, open]);

	const openList = () => {
		if (disabled || open) return;
		setOpen(true);
		setQuery('');
		setActive(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));
		if (onOpen) onOpen();
	};
	const close = () => {
		setOpen(false);
		setQuery('');
	};
	const pick = (o) => {
		onChange(o ? String(o.value) : '', o || null);
		close();
	};

	const onKeyDown = (e) => {
		if (disabled) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) return openList();
			const n = options.length;
			if (n) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
		} else if (e.key === 'Enter') {
			if (!open) return;
			e.preventDefault(); // choosing an option must not submit the surrounding form
			if (options[active]) pick(options[active]);
			else close();
		} else if (e.key === 'Escape') {
			if (open) {
				e.preventDefault();
				e.stopPropagation();
				close();
			}
		} else if (e.key === 'Home' && open) {
			e.preventDefault();
			setActive(0);
		} else if (e.key === 'End' && open) {
			e.preventDefault();
			setActive(Math.max(options.length - 1, 0));
		}
	};

	const shown = open ? query : label || '';
	const activeId = open && options[active] ? `${listId}-${active}` : undefined;
	const below = rect ? window.innerHeight - rect.bottom : 0;
	const flip = rect && below < 220 && rect.top > below;

	return (
		<div className={`combo ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`.trim()} ref={wrap}>
			<Icon name="search" size={14} className="combo__icon" />
			<input
				{...inputProps}
				ref={input}
				type="text"
				role="combobox"
				autoComplete="off"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-autocomplete="list"
				aria-activedescendant={activeId}
				className="combo__input"
				placeholder={label || value ? undefined : placeholder}
				value={shown}
				disabled={disabled}
				onFocus={openList}
				onClick={openList}
				onChange={(e) => {
					setQuery(e.target.value);
					setActive(0);
					if (!open) setOpen(true);
					if (onQuery) onQuery(e.target.value);
				}}
				onKeyDown={onKeyDown}
				onBlur={close}
			/>
			{loading ? <span className="spinner combo__spin" aria-hidden="true" /> : null}
			{clearable && value && !disabled ? (
				<button type="button" className="combo__clear" tabIndex={-1} aria-label="Clear selection" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)}>
					<Icon name="x" size={13} />
				</button>
			) : (
				<Icon name="chevronDown" size={14} className="combo__chevron" />
			)}
			{open && rect
				? createPortal(
						<ul
							id={listId}
							ref={list}
							role="listbox"
							className="combo__list"
							style={{ left: rect.left, width: rect.width, ...(flip ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(280, rect.top - 12) } : { top: rect.bottom + 4, maxHeight: Math.min(280, below - 12) }) }}
							onMouseDown={(e) => e.preventDefault()}
						>
							{options.map((o, i) => (
								<li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={String(o.value) === String(value)} className={`combo__opt ${i === active ? 'is-active' : ''} ${String(o.value) === String(value) ? 'is-selected' : ''}`.trim()} onMouseEnter={() => setActive(i)} onClick={() => pick(o)}>
									<span>{o.label}</span>
									{o.detail ? <small>{o.detail}</small> : null}
									{String(o.value) === String(value) ? <Icon name="check" size={14} /> : null}
								</li>
							))}
							{options.length === 0 ? (
								<li className="combo__empty" role="presentation">
									{loading ? 'Searching…' : error ? `Could not load options: ${error}` : emptyText}
								</li>
							) : null}
						</ul>,
						document.body
				  )
				: null}
		</div>
	);
}
