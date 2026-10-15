import React, { useCallback, useState } from 'react';
import { IconButton } from '../common/Button';
import Logo from '../common/Logo';
import GlobalSearch from './GlobalSearch';
import MobileNav from './MobileNav';
import NotificationsMenu from './NotificationsMenu';
import ThemeQuickMenu from './ThemeQuickMenu';
import UserMenu from './UserMenu';

/**
 * Slim top bar: search on the left; notifications, appearance and account on the right. On wide screens the brand and the
 * navigation live in the sidebar rail (SideNav); on phones this bar carries the menu button and brand
 * and opens the navigation drawer.
 */
export default function AppHeader() {
	const [drawer, setDrawer] = useState(false);
	const close = useCallback(() => setDrawer(false), []);
	return (
		<header className="app-header">
			<IconButton className="only-mobile" icon="menu" label="Open navigation" onClick={() => setDrawer(true)} aria-expanded={drawer} />
			<span className="only-mobile">
				<Logo />
			</span>
			<div className="header-search">
				<GlobalSearch />
			</div>
			<div className="header-spacer" />
			<div className="header-actions">
				<NotificationsMenu />
				<ThemeQuickMenu />
				<UserMenu />
			</div>
			{drawer ? <MobileNav onClose={close} /> : null}
		</header>
	);
}
