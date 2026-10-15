import React, { useCallback, useState } from 'react';
import { IconButton } from '../common/Button';
import Logo from '../common/Logo';
import GlobalSearch from './GlobalSearch';
import MobileNav from './MobileNav';
import NotificationsMenu from './NotificationsMenu';
import SubNav from './SubNav';

/**
 * Top bar in three parts: the pages of the current section on the left (SubNav), search centred, and
 * notifications on the right. On wide screens the brand, the primary navigation and the account live in the
 * sidebar rail (SideNav; themes and layout are in Settings); on phones the left part carries the menu button
 * and brand and opens the navigation drawer, which also holds the account.
 */
export default function AppHeader() {
	const [drawer, setDrawer] = useState(false);
	const close = useCallback(() => setDrawer(false), []);
	return (
		<header className="app-header">
			<div className="header-left">
				<IconButton className="only-mobile" icon="menu" label="Open navigation" onClick={() => setDrawer(true)} aria-expanded={drawer} />
				<span className="only-mobile">
					<Logo />
				</span>
				<SubNav />
			</div>
			<div className="header-search">
				<GlobalSearch />
			</div>
			<div className="header-actions">
				<NotificationsMenu />
			</div>
			{drawer ? <MobileNav onClose={close} /> : null}
		</header>
	);
}
