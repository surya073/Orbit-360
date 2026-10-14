import React, { useCallback, useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { IconButton } from '../common/Button';
import Logo from '../common/Logo';
import GlobalSearch from './GlobalSearch';
import MobileNav from './MobileNav';
import NotificationsMenu from './NotificationsMenu';
import ThemeQuickMenu from './ThemeQuickMenu';
import TopNav from './TopNav';
import UserMenu from './UserMenu';

/** Compact top bar: brand, adaptive navigation, search, notifications, appearance, account. */
export default function AppHeader() {
	const { user } = useAuth();
	const [drawer, setDrawer] = useState(false);
	const close = useCallback(() => setDrawer(false), []);
	return (
		<header className="app-header">
			<IconButton className="only-mobile" icon="menu" label="Open navigation" onClick={() => setDrawer(true)} aria-expanded={drawer} />
			<Logo />
			<TopNav role={user.role} />
			<div className="header-spacer" />
			<div className="header-actions">
				<GlobalSearch />
				<NotificationsMenu />
				<ThemeQuickMenu />
				<UserMenu />
			</div>
			{drawer ? <MobileNav role={user.role} onClose={close} /> : null}
		</header>
	);
}
