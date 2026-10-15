import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { visibleNav } from '../../config/navigation';
import { ROUTES } from '../../config/routes';
import { IconButton } from '../common/Button';
import Icon from '../common/Icon';
import Logo from '../common/Logo';

/** Slide-in navigation for narrow screens. Closes on navigation, Escape, or backdrop press. */
export default function MobileNav({ onClose }) {
	const { pathname } = useLocation();
	const { can } = useAuth();
	const first = useRef(pathname);
	const ref = useRef(null);

	useEffect(() => {
		if (pathname !== first.current) onClose();
	}, [pathname, onClose]);
	useEffect(() => {
		const el = ref.current;
		el && el.querySelector('button').focus();
		const key = (e) => e.key === 'Escape' && onClose();
		document.addEventListener('keydown', key);
		return () => document.removeEventListener('keydown', key);
	}, [onClose]);

	const link = (to, label, icon, end) => (
		<NavLink key={to} to={to} end={end} className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
			<Icon name={icon} size={16} />
			{label}
		</NavLink>
	);

	return createPortal(
		<div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="drawer" ref={ref} role="dialog" aria-modal="true" aria-label="Navigation">
				<div className="drawer__head">
					<Logo link={false} />
					<IconButton icon="x" label="Close navigation" onClick={onClose} />
				</div>
				<nav aria-label="Mobile">
					{visibleNav(can).map((item) =>
						item.type === 'link' ? (
							link(item.to, item.label, item.icon, item.end)
						) : (
							<div key={item.label}>
								<div className="drawer__group">{item.label}</div>
								{item.items.map((i) => link(i.to, i.label, i.icon))}
							</div>
						)
					)}
					<div className="drawer__group">Account</div>
					{link(ROUTES.settings, 'Settings', 'settings')}
				</nav>
			</div>
		</div>,
		document.body
	);
}
