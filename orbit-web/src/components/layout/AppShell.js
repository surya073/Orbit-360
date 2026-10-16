import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TourProvider } from '../../app/providers/TourProvider';
import LoadingState from '../feedback/LoadingState';
import { ROUTES } from '../../config/routes';
import useScrollReveal from '../../hooks/useScrollReveal';
import AppHeader from '../navigation/AppHeader';
import BackToTop from './BackToTop';
import SideNav from '../navigation/SideNav';

export default function AppShell() {
	const { pathname } = useLocation();
	// The spreadsheet and the reporting-structure builder are workspaces: it fills the viewport under the header instead of scrolling the page.
	const workspace = pathname === ROUTES.spreadsheet || pathname === ROUTES.reporting;
	useScrollReveal('#main', [pathname]);
	// A new page starts at its top (a tab or filter change inside a page keeps its scroll position).
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);
	return (
		<TourProvider>
			<div className={`shell ${workspace ? 'shell--workspace' : ''}`.trim()}>
				<SideNav />
				<div className="shell__body">
					<a href="#main" className="skip-link">
						Skip to content
					</a>
					<AppHeader />
					<main id="main" className={`main ${workspace ? 'main--workspace' : ''}`.trim()} tabIndex={-1}>
						{/* keyed by route so each page eases in */}
						<div className="page" key={pathname}>
							<Suspense fallback={<LoadingState lines={4} label="Loading page" />}>
								<Outlet />
							</Suspense>
						</div>
					</main>
				</div>
			</div>
			<BackToTop />
		</TourProvider>
	);
}
