import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { visibleNav } from '../../config/navigation';
import { ROUTES } from '../../config/routes';
import { navTarget } from '../../config/tour';
import { moduleForPath } from '../../features/spreadsheet/spreadsheetModules';
import Icon from '../common/Icon';
import logo from '../../assets/images/logo.svg';

const EXPAND_KEY = 'company360.navExpanded';
const readExpanded = () => {
	try {
		return window.localStorage.getItem(EXPAND_KEY) === '1';
	} catch {
		return false;
	}
};

/** One destination: a round icon, and (when the rail is expanded) its label. The active one curves out of the rail into the page. */
function RailLink({ item, to, onClick }) {
	return (
		<NavLink to={to} end={item.end} onClick={onClick} data-tour={navTarget(item.label)} data-label={item.label} aria-label={item.label} className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}>
			<span className="rail-item__icon" data-tip={item.label}>
				<Icon name={item.icon} size={20} />
			</span>
			<span className="rail-item__label">{item.label}</span>
		</NavLink>
	);
}

/** Floating list of a group's pages next to the rail (collapsed rail). Positioned from the trigger, outside the rail's own clipping. */
function Flyout({ anchor, group, onClose }) {
	const ref = useRef(null);
	const [pos, setPos] = useState(null);
	useLayoutEffect(() => {
		if (!anchor.current) return;
		const r = anchor.current.getBoundingClientRect();
		const h = ref.current ? ref.current.offsetHeight : 240;
		setPos({ left: r.right + 14, top: Math.min(Math.max(r.top + r.height / 2 - 28, 12), Math.max(window.innerHeight - h - 12, 12)) });
	}, [anchor, group]);
	useEffect(() => {
		const away = (e) => {
			if (ref.current && !ref.current.contains(e.target) && !(anchor.current && anchor.current.contains(e.target))) onClose();
		};
		const esc = (e) => {
			if (e.key === 'Escape') {
				onClose();
				if (anchor.current) anchor.current.focus();
			} else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ref.current) {
				// Arrow keys move through the group's pages (from the trigger or from inside the list).
				const links = [...ref.current.querySelectorAll('a')];
				if (!links.length) return;
				e.preventDefault();
				const i = links.indexOf(document.activeElement);
				const next = e.key === 'ArrowDown' ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
				links[i < 0 && e.key === 'ArrowUp' ? links.length - 1 : next].focus();
			}
		};
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', esc);
		};
	}, [anchor, onClose]);
	return createPortal(
		<div ref={ref} className="rail-flyout" role="group" aria-label={`${group.label} pages`} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
			<div className="rail-flyout__title">{group.label}</div>
			{group.items.map((i) => (
				<NavLink key={i.to} to={i.to} onClick={onClose} className={({ isActive }) => `rail-flyout__link ${isActive ? 'active' : ''}`}>
					<span className="rail-flyout__icon">
						<Icon name={i.icon} size={16} />
					</span>
					<span>
						{i.label}
						<small>{i.description}</small>
					</span>
				</NavLink>
			))}
		</div>,
		document.body
	);
}

function RailGroup({ group, expanded, open, onOpenChange, active }) {
	const trigger = useRef(null);
	return (
		<div className={`rail-group ${open && expanded ? 'is-open' : ''}`.trim()}>
			<button ref={trigger} type="button" className={`rail-item ${active ? 'active' : ''}`.trim()} data-tour={navTarget(group.label)} data-label={group.label} aria-label={group.label} aria-haspopup="true" aria-expanded={open} onClick={() => onOpenChange(!open)}>
				<span className="rail-item__icon" data-tip={group.label}>
					<Icon name={group.icon} size={20} />
				</span>
				<span className="rail-item__label">{group.label}</span>
				<Icon name="chevronDown" size={14} className="rail-item__chev" />
			</button>
			{open && expanded ? (
				<div className="rail-sub" role="group" aria-label={`${group.label} pages`}>
					{group.items.map((i) => (
						<NavLink key={i.to} to={i.to} className={({ isActive }) => `rail-sub__link ${isActive ? 'active' : ''}`}>
							<Icon name={i.icon} size={15} />
							{i.label}
						</NavLink>
					))}
				</div>
			) : null}
			{open && !expanded ? <Flyout anchor={trigger} group={group} onClose={() => onOpenChange(false)} /> : null}
		</div>
	);
}

/**
 * Primary navigation as a vertical gradient rail: round icons, the active page curving out of the rail
 * into the content, groups as flyouts (or inline lists when the rail is expanded). Which entries appear
 * follows the user's permissions. UX only: the backend authorizes every request.
 */
export default function SideNav() {
	const { can } = useAuth();
	const { pathname } = useLocation();
	const [expanded, setExpanded] = useState(readExpanded);
	// undefined = default (the active group is open when expanded), a label = that group, '' = none.
	const [openGroup, setOpenGroup] = useState(undefined);
	const sheetModule = moduleForPath(pathname); // from a module page the Spreadsheet link opens that module's sheet

	useEffect(() => {
		try {
			window.localStorage.setItem(EXPAND_KEY, expanded ? '1' : '0');
		} catch {
			/* not remembered */
		}
		document.documentElement.style.setProperty('--rail-w', expanded ? '248px' : '76px');
		return () => document.documentElement.style.removeProperty('--rail-w');
	}, [expanded]);
	// A flyout belongs to the page it was opened on.
	useEffect(() => setOpenGroup(undefined), [pathname]);
	const nav = visibleNav(can);
	const isActiveGroup = (g) => g.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

	return (
		<aside className={`rail ${expanded ? 'is-expanded' : ''}`.trim()} aria-label="Sidebar">
			<div className="rail__top">
				<button type="button" className="rail__toggle" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={expanded} title={expanded ? 'Collapse' : 'Expand'}>
					<Icon name="menu" size={20} />
				</button>
				<span className="rail__brand" aria-hidden="true">
					<img src={logo} alt="" width="22" height="22" />
					<b>Company 360</b>
				</span>
			</div>
			<nav className="rail__nav" aria-label="Primary">
				{nav.map((item) =>
					item.type === 'link' ? (
						<RailLink key={item.to} item={item} to={item.to === ROUTES.spreadsheet && sheetModule ? `${item.to}?module=${sheetModule}` : item.to} />
					) : (
						<RailGroup key={item.label} group={item} expanded={expanded} open={openGroup === undefined ? expanded && isActiveGroup(item) : openGroup === item.label} active={isActiveGroup(item)} onOpenChange={(on) => setOpenGroup(on ? item.label : '')} />
					)
				)}
			</nav>
			<div className="rail__bottom">
				<NavLink to={ROUTES.settings} data-label="Settings" aria-label="Settings" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}>
					<span className="rail-item__icon" data-tip="Settings">
						<Icon name="settings" size={20} />
					</span>
					<span className="rail-item__label">Settings</span>
				</NavLink>
			</div>
		</aside>
	);
}
