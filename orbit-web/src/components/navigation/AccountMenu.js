import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTour } from '../../app/providers/TourProvider';
import { ROUTES } from '../../config/routes';
import Icon from '../common/Icon';

const initials = (name = '') =>
	name
		.split(/[\s@.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('') || '?';

/**
 * Who is signed in, at the bottom of the sidebar: the avatar when the rail is collapsed, the name and role as
 * well when it is expanded. Opens the account menu beside the rail (in a portal, because the rail clips anything
 * that overflows it).
 */
export default function AccountMenu() {
	const { user, can, signOut } = useAuth();
	const tour = useTour();
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState(null);
	const trigger = useRef(null);
	const menu = useRef(null);
	const role = user.roleName || (user.role === 'admin' ? 'Administrator' : 'Manager');
	const close = useCallback(() => setOpen(false), []);

	useLayoutEffect(() => {
		if (!open || !trigger.current) return;
		const r = trigger.current.getBoundingClientRect();
		const bottom = Math.max(window.innerHeight - r.bottom - 4, 12);
		// beside the rail, on whichever side it is docked
		setPos(trigger.current.closest('.shell--rail-right') ? { right: window.innerWidth - r.left + 14, bottom } : { left: r.right + 14, bottom });
	}, [open]);

	useEffect(() => {
		if (!open) return undefined;
		const away = (e) => {
			if (menu.current && !menu.current.contains(e.target) && !(trigger.current && trigger.current.contains(e.target))) close();
		};
		const esc = (e) => {
			if (e.key === 'Escape') {
				close();
				if (trigger.current) trigger.current.focus();
			}
		};
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', esc);
		};
	}, [open, close]);

	return (
		<div className="rail-account">
			<button ref={trigger} type="button" data-tour="account" className="rail-item rail-account__btn" aria-label={`Account menu for ${user.displayName}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
				<span className="rail-item__icon rail-account__avatar" data-tip={user.displayName} aria-hidden="true">
					{initials(user.displayName)}
				</span>
				<span className="rail-item__label rail-account__text" aria-hidden="true">
					<b>{user.displayName}</b>
					<small>{role}</small>
				</span>
				<Icon name="chevronDown" size={14} className="rail-account__chev" />
			</button>
			{open
				? createPortal(
						<div ref={menu} className="rail-menu" role="group" aria-label="Account" style={pos || { visibility: 'hidden' }}>
							<div className="popover__head">
								<strong>{user.displayName}</strong>
								{user.email}
								<br />
								{role} · {user.teamId ? 'assigned team' : 'all teams'}
							</div>
							<Link className="menu-item" to={`${ROUTES.settings}?tab=profile`} onClick={close}>
								<Icon name="user" size={15} />
								Profile
							</Link>
							<Link className="menu-item" to={`${ROUTES.settings}?tab=appearance`} onClick={close}>
								<Icon name="palette" size={15} />
								Themes
							</Link>
							<Link className="menu-item" to={`${ROUTES.settings}?tab=layout`} onClick={close}>
								<Icon name="dashboard" size={15} />
								Layout
							</Link>
							<Link className="menu-item" to={ROUTES.settings} onClick={close}>
								<Icon name="settings" size={15} />
								Settings
							</Link>
							{can('access.view') ? (
								<Link className="menu-item" to={ROUTES.access} onClick={close}>
									<Icon name="lock" size={15} />
									Access &amp; Permissions
								</Link>
							) : null}
							<button
								type="button"
								className="menu-item"
								onClick={() => {
									close();
									tour.start();
								}}
							>
								<Icon name="sparkles" size={15} />
								Take the tour
							</button>
							<div className="menu-sep" />
							<button type="button" className="menu-item" onClick={signOut}>
								<Icon name="logout" size={15} />
								Sign out
							</button>
						</div>,
						document.body
				  )
				: null}
		</div>
	);
}
