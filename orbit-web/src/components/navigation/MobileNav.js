import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import logo from '../../assets/images/logo.svg';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTour } from '../../app/providers/TourProvider';
import { visibleNav } from '../../config/navigation';
import { ROUTES } from '../../config/routes';
import useScrollLock from '../../hooks/useScrollLock';
import { IconButton } from '../common/Button';
import Icon from '../common/Icon';

const SWIPE_CLOSE_PX = 70;
const initials = (name = '') =>
	name
		.split(/[\s@.]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('') || '?';

function Item({ to, label, icon, end, i = 0 }) {
	return (
		<NavLink to={to} end={end} className={({ isActive }) => `oc-item ${isActive ? 'active' : ''}`} style={{ '--i': i }}>
			<span className="oc-item__icon" aria-hidden="true">
				<Icon name={icon} size={19} />
			</span>
			<span className="oc-item__label">{label}</span>
		</NavLink>
	);
}

/**
 * Slide-in navigation for narrow screens, in the same language as the sidebar rail: an accent-gradient
 * panel, round icon chips, a profile card, grouped sections and quick actions. Closes on navigation,
 * Escape, a backdrop tap or a swipe to the left. Focus stays inside while it is open.
 */
export default function MobileNav({ onClose }) {
	const { pathname } = useLocation();
	const { user, can, signOut } = useAuth();
	const tour = useTour();
	const first = useRef(pathname);
	const ref = useRef(null);
	const touch = useRef(null);
	const [drag, setDrag] = useState(0);

	useEffect(() => {
		if (pathname !== first.current) onClose();
	}, [pathname, onClose]);

	useEffect(() => {
		const el = ref.current;
		if (el) el.querySelector('button').focus();
		const key = (e) => {
			if (e.key === 'Escape') {
				onClose();
				return;
			}
			if (e.key !== 'Tab' || !el) return;
			const items = [...el.querySelectorAll('a[href],button:not([disabled])')];
			if (!items.length) return;
			const a = items[0];
			const z = items[items.length - 1];
			if (e.shiftKey && document.activeElement === a) {
				e.preventDefault();
				z.focus();
			} else if (!e.shiftKey && document.activeElement === z) {
				e.preventDefault();
				a.focus();
			}
		};
		document.addEventListener('keydown', key);
		return () => {
			document.removeEventListener('keydown', key);
		};
	}, [onClose]);
	useScrollLock(); // the page behind must not scroll while the menu is open

	// Swipe left to close: the panel follows the finger, then either leaves or springs back.
	const onTouchStart = (e) => {
		touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, live: false };
	};
	const onTouchMove = (e) => {
		const t = touch.current;
		if (!t) return;
		const dx = e.touches[0].clientX - t.x;
		const dy = e.touches[0].clientY - t.y;
		if (!t.live && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) t.live = true; // a horizontal gesture, not a scroll
		if (t.live) setDrag(Math.min(dx, 0));
	};
	const onTouchEnd = () => {
		const t = touch.current;
		touch.current = null;
		if (t && t.live && drag < -SWIPE_CLOSE_PX) onClose();
		else setDrag(0);
	};

	const nav = visibleNav(can);
	let n = 0;
	const roleLine = `${user.roleName || (user.role === 'admin' ? 'Administrator' : 'Manager')} · ${user.teamId ? 'your team' : 'all teams'}`;

	return createPortal(
		<div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<aside
				className={`offcanvas ${drag ? 'is-dragging' : ''}`.trim()}
				ref={ref}
				role="dialog"
				aria-modal="true"
				aria-label="Navigation"
				style={drag ? { transform: `translateX(${drag}px)` } : undefined}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
			>
				<span className="offcanvas__glow" aria-hidden="true" />
				<header className="offcanvas__head">
					<span className="offcanvas__brand">
						<img src={logo} alt="" width="26" height="26" />
						<b>Orbit 360</b>
					</span>
					<IconButton icon="x" label="Close navigation" className="offcanvas__close" onClick={onClose} />
				</header>
				<div className="offcanvas__user">
					<span className="offcanvas__avatar" aria-hidden="true">
						{initials(user.displayName)}
					</span>
					<span className="offcanvas__who">
						<b>{user.displayName}</b>
						<small>{roleLine}</small>
					</span>
				</div>
				<nav aria-label="Mobile" className="offcanvas__nav">
					{nav
						.filter((item) => item.label !== 'Settings')
						.map((item) =>
						item.type === 'link' ? (
							<Item key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.end} i={n++} />
						) : (
							<div key={item.label} className="oc-group" role="group" aria-label={item.label}>
								<div className="oc-label">{item.label}</div>
								{item.items.map((i) => (
									<Item key={i.to} to={i.to} label={i.label} icon={i.icon} i={n++} />
								))}
							</div>
						)
					)}
				</nav>
				<footer className="offcanvas__foot">
					<Item to={ROUTES.settings} label="Settings" icon="settings" i={n++} />
					<button
						type="button"
						className="oc-item"
						style={{ '--i': n++ }}
						onClick={() => {
							onClose();
							tour.start();
						}}
					>
						<span className="oc-item__icon" aria-hidden="true">
							<Icon name="sparkles" size={19} />
						</span>
						<span className="oc-item__label">Take the tour</span>
					</button>
					<button type="button" className="oc-item oc-item--quiet" style={{ '--i': n++ }} onClick={signOut}>
						<span className="oc-item__icon" aria-hidden="true">
							<Icon name="logout" size={19} />
						</span>
						<span className="oc-item__label">Sign out</span>
					</button>
				</footer>
			</aside>
		</div>,
		document.body
	);
}
