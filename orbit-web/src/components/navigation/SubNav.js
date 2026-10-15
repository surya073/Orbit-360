import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { activeGroup } from '../../config/navigation';
import Icon from '../common/Icon';

/**
 * The pages of the section you are in, shown in the top bar (People: Employees, Teams, Attendance, ...).
 * The sidebar only picks the section; this is where you move between its pages. It renders nothing on
 * pages that are not part of a group, and follows the user's permissions like the sidebar does.
 * Phones use the navigation drawer instead. The CSS sheds the group label, then the icons, to fit the room
 * the centred search leaves; if even that is not enough the strip scrolls, fades the cut edge, and keeps
 * the current page in view.
 */
export default function SubNav() {
	const { can } = useAuth();
	const { pathname } = useLocation();
	const group = activeGroup(can, pathname);
	const groupLabel = group ? group.label : '';
	const list = useRef(null);
	const [fade, setFade] = useState('');

	const measure = useCallback(() => {
		const el = list.current;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		if (max <= 1) setFade('');
		else setFade(el.scrollLeft <= 1 ? 'fade-end' : el.scrollLeft >= max - 1 ? 'fade-start' : 'fade-both');
	}, []);

	useEffect(() => {
		const el = list.current;
		if (!el) return undefined;
		const current = el.querySelector('.active');
		if (current && current.scrollIntoView) current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
		measure();
		el.addEventListener('scroll', measure, { passive: true });
		window.addEventListener('resize', measure);
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
		if (ro) ro.observe(el);
		return () => {
			el.removeEventListener('scroll', measure);
			window.removeEventListener('resize', measure);
			if (ro) ro.disconnect();
		};
	}, [pathname, groupLabel, measure]);

	if (!group) return null;
	// A mouse wheel has no horizontal axis: while the strip overflows, let it scroll sideways.
	const onWheel = (e) => {
		const el = list.current;
		if (el && el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
	};
	return (
		// keyed by group so switching sections plays the entrance again
		<nav className="subnav" key={group.label} aria-label={`${group.label} pages`}>
			<span className="subnav__group" aria-hidden="true">
				{group.label}
			</span>
			<ul className={`subnav__list ${fade}`.trim()} ref={list} onWheel={onWheel}>
				{group.items.map((i, n) => (
					<li key={i.to} style={{ '--i': n }}>
						<NavLink to={i.to} title={i.description} className={({ isActive }) => `subnav__link ${isActive ? 'active' : ''}`.trim()}>
							<Icon name={i.icon} size={15} />
							<span>{i.label}</span>
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
