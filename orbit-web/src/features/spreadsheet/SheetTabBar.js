import React, { useCallback, useEffect, useRef, useState } from 'react';
import FloatingPanel from '../../components/common/FloatingPanel';
import { MAX_NAME } from './tabStore';

function TabName({ tab, onRename, onDone }) {
	const [value, setValue] = useState(tab.name);
	const done = useRef(false);
	const finish = (commit) => {
		if (done.current) return;
		done.current = true;
		if (commit) onRename(value);
		onDone();
	};
	return (
		<input
			className="sheet-tab__rename"
			aria-label={`Rename ${tab.name}`}
			value={value}
			maxLength={MAX_NAME}
			autoFocus
			onFocus={(e) => e.target.select()}
			onChange={(e) => setValue(e.target.value)}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === 'Enter') finish(true);
				else if (e.key === 'Escape') finish(false);
			}}
			onBlur={() => finish(true)}
		/>
	);
}

/**
 * Sheet tabs along the bottom, like a spreadsheet. Every tab is its own sheet (a record type with
 * its own edits, search, sort and selection). Double-click or F2 renames, the x closes (never the
 * last one), and + adds "Sheet N" for a chosen record type.
 *
 * The same bar also carries the active sheet's status line (selection, search info, pager): the sheet renders it
 * into `statusRef`'s element. Tabs and status are one row in one container; when they do not fit, the whole bar scrolls
 * sideways (a mouse wheel scrolls it too).
 */
export default function SheetTabBar({ tabs, activeId, dirty, modules, onSelect, onAdd, onRename, onClose, statusRef }) {
	const [renaming, setRenaming] = useState(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const refs = useRef({});
	const bar = useRef(null);
	const addBtn = useRef(null);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	// A mouse wheel has no sideways axis: let it scroll the bar when the bar overflows.
	useEffect(() => {
		const el = bar.current;
		if (!el) return undefined;
		const onWheel = (e) => {
			if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
			el.scrollLeft += e.deltaY;
			e.preventDefault();
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	useEffect(() => {
		if (renaming && !tabs.some((t) => t.id === renaming)) setRenaming(null);
	}, [tabs, renaming]);

	const onKeyDown = (e, tab, i) => {
		if (e.key === 'F2') {
			e.preventDefault();
			setRenaming(tab.id);
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
			onSelect(next.id);
			requestAnimationFrame(() => refs.current[next.id] && refs.current[next.id].focus());
		}
	};

	return (
		<div className="sheet-tabs" ref={bar}>
			<div className="sheet-tabs__list" role="tablist" aria-label="Sheets">
				{tabs.map((t, i) => {
					const active = t.id === activeId;
					return (
						<div key={t.id} className={`sheet-tab ${active ? 'is-active' : ''}`.trim()}>
							{renaming === t.id ? (
								<TabName tab={t} onRename={(name) => onRename(t.id, name)} onDone={() => setRenaming(null)} />
							) : (
								<button
									type="button"
									role="tab"
									id={`sheet-tab-${t.id}`}
									aria-selected={active}
									aria-controls={`sheet-pane-${t.id}`}
									tabIndex={active ? 0 : -1}
									ref={(el) => {
										refs.current[t.id] = el;
									}}
									className="sheet-tab__label"
									title={`${t.title} · double-click to rename`}
									onClick={() => onSelect(t.id)}
									onDoubleClick={() => setRenaming(t.id)}
									onKeyDown={(e) => onKeyDown(e, t, i)}
								>
									<span>{t.name}</span>
									<small>{t.title}</small>
									{dirty[t.id] ? <i className="sheet-tab__dirty" role="img" aria-label="Unsaved changes" title="Unsaved changes" /> : null}
								</button>
							)}
							{tabs.length > 1 ? (
								<button type="button" className="sheet-tab__close" aria-label={`Close ${t.name}`} title={`Close ${t.name}`} onClick={() => onClose(t.id)}>
									×
								</button>
							) : null}
						</div>
					);
				})}
			</div>
			<button type="button" ref={addBtn} className="sheet-tabs__add" aria-label="Add sheet" aria-haspopup="true" aria-expanded={menuOpen} title="Add a sheet" onClick={() => setMenuOpen((o) => !o)}>
				+
			</button>
			<FloatingPanel anchorRef={addBtn} open={menuOpen} onClose={closeMenu} align="left" width={240} gap={6} className="sheet-tabs__panel" role="group" aria-label="Add a sheet">
				<div className="sheet-tabs__menu">
					<span className="small muted sheet-tabs__menu-title">New sheet for…</span>
					{modules.map((m) => (
						<button
							key={m.resource}
							type="button"
							className="menu-item"
							onClick={() => {
								closeMenu();
								onAdd(m.resource);
							}}
						>
							{m.title}
						</button>
					))}
				</div>
			</FloatingPanel>
			<div className="sheet-tabs__status" ref={statusRef} />
		</div>
	);
}
