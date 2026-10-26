import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { isGroupActive, isLinkActive, visibleNav } from '../../config/navigation';
import { navTarget } from '../../config/tour';
import Icon from '../common/Icon';
import AccountMenu from './AccountMenu';
import logo from '../../assets/images/logo.svg';

const EXPAND_KEY = 'company360.navExpanded';
const readExpanded = () => {
	try {
		return window.localStorage.getItem(EXPAND_KEY) === '1';
	} catch {
		return false;
	}
};

const Inner = ({ item }) => (
	<>
		<span className="rail-item__icon" data-tip={item.label}>
			<Icon name={item.icon} size={20} />
		</span>
		<span className="rail-item__label">{item.label}</span>
	</>
);

/** One destination: a round icon, and (when the rail is expanded) its label. The active one curves out of the rail into the page. */
function RailLink({ item, pathname }) {
	const active = isLinkActive(item, pathname);
	return (
		<Link to={item.to} data-tour={navTarget(item.label)} data-label={item.label} aria-label={item.label} aria-current={active ? 'page' : undefined} className={`rail-item ${active ? 'active' : ''}`.trim()}>
			<Inner item={item} />
		</Link>
	);
}

/**
 * A group (People, Delivery) is one entry in the rail. It opens the group's first page, and the top bar
 * (SubNav) then lists every page of the group, so the rail never needs a menu of its own.
 */
function RailGroup({ group, active }) {
	return (
		<Link to={group.items[0].to} data-tour={navTarget(group.label)} data-label={group.label} aria-label={group.label} aria-current={active ? 'true' : undefined} className={`rail-item ${active ? 'active' : ''}`.trim()}>
			<Inner item={group} />
		</Link>
	);
}

/**
 * Primary navigation as a vertical gradient rail: round icons, the active page curving out of the rail
 * into the content. Which entries appear follows the user's permissions. UX only: the backend
 * authorizes every request.
 */
export default function SideNav() {
	const { can } = useAuth();
	const { pathname } = useLocation();
	const [expanded, setExpanded] = useState(readExpanded);

	useEffect(() => {
		try {
			window.localStorage.setItem(EXPAND_KEY, expanded ? '1' : '0');
		} catch {
			/* not remembered */
		}
		document.documentElement.style.setProperty('--rail-w', expanded ? '248px' : '76px');
		return () => document.documentElement.style.removeProperty('--rail-w');
	}, [expanded]);
	const all = visibleNav(can);
	const nav = all.filter((n) => n.label !== 'Settings');
	const settings = all.find((n) => n.label === 'Settings'); // the last module: it sits at the foot of the rail

	return (
		<aside className={`rail ${expanded ? 'is-expanded' : ''}`.trim()} aria-label="Sidebar">
			<div className="rail__top">
				<button type="button" className="rail__toggle" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={expanded} title={expanded ? 'Collapse' : 'Expand'}>
					<Icon name="menu" size={20} />
				</button>
				<span className="rail__brand" aria-hidden="true">
					<img src={logo} alt="" width="22" height="22" />
					<b>Orbit 360</b>
				</span>
			</div>
			<nav className="rail__nav" aria-label="Primary">
				{nav.map((item) =>
					item.type === 'link' ? (
						<RailLink key={item.to} item={item} pathname={pathname} />
					) : (
						<RailGroup key={item.label} group={item} active={isGroupActive(item, pathname)} />
					)
				)}
{/* Settings is the last page link */}
				{settings ? (
					<Link to={settings.items[0].to} data-tour="appearance" data-label="Settings" aria-label="Settings" aria-current={isGroupActive(settings, pathname) ? 'true' : undefined} className={`rail-item ${isGroupActive(settings, pathname) ? 'active' : ''}`.trim()}>
						<Inner item={settings} />
					</Link>
				) : null}
			</nav>
			{/* only the profile sits at the foot of the rail */}
			<div className="rail__bottom">
				<AccountMenu />
			</div>
		</aside>
	);
}
