import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from '../../config/constants';
import { flatDestinations } from '../../config/navigation';
import useApiResource from '../../hooks/useApiResource';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { searchAll } from '../../services/searchService';
import Icon from '../common/Icon';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

/**
 * Global search: jump to a page, or find employees, projects, product items and AI usage
 * records. Record searches call the real list endpoints with `q` (debounced, aborted when the
 * query changes); the backend authorizes and team-scopes every result, so a manager only ever
 * sees their team's records.
 */
export default function GlobalSearch() {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const onKey = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setOpen((o) => !o);
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);
	const trigger = useRef(null);
	return (
		<>
			<button type="button" ref={trigger} data-tour="search" className="search-trigger" onClick={() => setOpen(true)} aria-label="Search" aria-haspopup="dialog">
				<Icon name="search" size={15} />
				<span className="search-trigger__label">Search</span>
				<span className="search-trigger__hint" aria-hidden="true">
					pages, people, projects…
				</span>
				<kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
			</button>
			{open ? (
				<Palette
					onClose={() => {
						setOpen(false);
						trigger.current && trigger.current.focus();
					}}
				/>
			) : null}
		</>
	);
}

function Palette({ onClose }) {
	const { can } = useAuth();
	const navigate = useNavigate();
	const [q, setQ] = useState('');
	const [index, setIndex] = useState(0);
	const dq = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
	const term = dq.trim();
	const active = term.length >= SEARCH_MIN_CHARS && q.trim() === term;

	const res = useApiResource((signal) => searchAll(term, signal, can).then((data) => ({ data })), `search|${term}`, { enabled: active, isEmpty: () => false });
	const groups = useMemo(() => (active && res.data ? res.data : []), [active, res.data]);

	const pages = useMemo(() => {
		const needle = q.trim().toLowerCase();
		const all = flatDestinations(can);
		return (needle ? all.filter((d) => d.label.toLowerCase().includes(needle)) : all).slice(0, needle ? 6 : 12);
	}, [q, can]);

	const options = useMemo(
		() => [
			...pages.map((p) => ({ id: `page-${p.to}`, kind: 'page', title: p.label, detail: p.group || 'Page', to: p.to })),
			...groups.flatMap((g) => g.items.map((it) => ({ id: `${g.source.key}-${it.id}`, kind: 'record', group: g.source.label, title: it.title, detail: it.detail, to: `${g.source.route}?q=${encodeURIComponent(it.title)}` }))),
		],
		[pages, groups]
	);
	useEffect(() => setIndex(0), [q, res.data]);

	const go = (opt) => {
		if (!opt) return;
		onClose();
		navigate(opt.to);
	};
	const onKeyDown = (e) => {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			setIndex((i) => Math.min(i + 1, options.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			go(options[index]);
		}
	};

	const failed = groups.filter((g) => g.error);
	const forbidden = failed.length === groups.length && groups.length > 0 && failed.every((g) => g.error.status === 403 || g.error.status === 401);
	let lastGroup = null;

	return createPortal(
		<div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="palette" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKeyDown}>
				<div className="palette__input">
					<Icon name="search" size={16} />
					<input
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search pages, employees, projects…"
						role="combobox"
						aria-expanded="true"
						aria-controls="palette-list"
						aria-activedescendant={options[index] ? `opt-${options[index].id}` : undefined}
						aria-label="Search"
					/>
					{res.status === 'loading' && active ? <span className="spinner" aria-hidden="true" /> : null}
				</div>
				<div className="palette__results" id="palette-list" role="listbox" aria-label="Results">
					{options.map((o, i) => {
						const heading = o.kind === 'page' ? (lastGroup !== 'Go to' ? 'Go to' : null) : lastGroup !== o.group ? o.group : null;
						lastGroup = o.kind === 'page' ? 'Go to' : o.group;
						return (
							<React.Fragment key={o.id}>
								{heading ? <div className="palette__group">{heading}</div> : null}
								<button type="button" id={`opt-${o.id}`} role="option" aria-selected={i === index} className="palette__item" onMouseEnter={() => setIndex(i)} onClick={() => go(o)}>
									<Icon name={o.kind === 'page' ? 'chevronRight' : 'search'} size={14} />
									{o.title}
									<small>{o.detail}</small>
								</button>
							</React.Fragment>
						);
					})}
					<div aria-live="polite" className="small muted" style={{ padding: 'var(--space-2)' }}>
						{q.trim() && q.trim().length < SEARCH_MIN_CHARS ? `Type at least ${SEARCH_MIN_CHARS} characters to search records.` : null}
						{active && res.status === 'loading' && !res.data ? 'Searching…' : null}
						{active && res.status === 'error' ? `Search is unavailable: ${res.error.message}` : null}
						{active && forbidden ? 'You do not have access to search these records.' : null}
						{active && !forbidden && failed.length ? `Unavailable right now: ${failed.map((g) => g.source.label).join(', ')}.` : null}
						{active && res.data && !res.data.some((g) => g.items.length) && !failed.length ? `No records match “${term}”.` : null}
					</div>
				</div>
				<div className="palette__foot">Searches only records you are authorised to see. ↑↓ to move, Enter to open, Esc to close.</div>
			</div>
		</div>,
		document.body
	);
}
