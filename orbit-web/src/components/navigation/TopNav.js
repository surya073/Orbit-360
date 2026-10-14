import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { visibleNav } from '../../config/navigation';
import Icon from '../common/Icon';
import Popover from '../common/Popover';

/** Compact primary navigation. Groups open as dropdowns; the active section is highlighted. */
export default function TopNav({ role }) {
	const { pathname } = useLocation();
	return (
		<nav className="top-nav" aria-label="Primary">
			{visibleNav(role).map((item) =>
				item.type === 'link' ? (
					<NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
						{item.label}
					</NavLink>
				) : (
					<Popover
						key={item.label}
						align="left"
						label={`${item.label} pages`}
						trigger={({ toggle, props }) => (
							<button type="button" className={`nav-trigger ${item.items.some((i) => pathname.startsWith(i.to)) ? 'active' : ''}`} onClick={toggle} {...props}>
								{item.label}
								<Icon name="chevronDown" size={13} />
							</button>
						)}
					>
						{({ close }) => (
							<div style={{ minWidth: 250 }}>
								{item.items.map((i) => (
									<NavLink key={i.to} to={i.to} onClick={close} className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
										<Icon name={i.icon} size={15} />
										<span>
											{i.label}
											<small>{i.description}</small>
										</span>
									</NavLink>
								))}
							</div>
						)}
					</Popover>
				)
			)}
		</nav>
	);
}
