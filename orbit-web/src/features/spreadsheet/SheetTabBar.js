import React, { useEffect, useRef, useState } from 'react';
import Popover from '../../components/common/Popover';
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
 */
export default function SheetTabBar({ tabs, activeId, dirty, modules, onSelect, onAdd, onRename, onClose }) {
	const [renaming, setRenaming] = useState(null);
	const refs = useRef({});

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
		<div className="sheet-tabs">
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
			<Popover
				label="Add a sheet"
				align="left"
				trigger={({ toggle, props }) => (
					<button type="button" className="sheet-tabs__add" aria-label="Add sheet" title="Add a sheet" onClick={toggle} {...props}>
						+
					</button>
				)}
			>
				{({ close }) => (
					<div className="sheet-tabs__menu">
						<span className="small muted sheet-tabs__menu-title">New sheet for…</span>
						{modules.map((m) => (
							<button
								key={m.resource}
								type="button"
								className="menu-item"
								onClick={() => {
									close();
									onAdd(m.resource);
								}}
							>
								{m.title}
							</button>
						))}
					</div>
				)}
			</Popover>
		</div>
	);
}
