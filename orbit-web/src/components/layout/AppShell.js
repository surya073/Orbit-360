import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import LoadingState from '../feedback/LoadingState';
import { ROUTES } from '../../config/routes';
import AppHeader from '../navigation/AppHeader';

export default function AppShell() {
	const { pathname } = useLocation();
	// The spreadsheet and the reporting-structure builder are workspaces: it fills the viewport under the header instead of scrolling the page.
	const workspace = pathname === ROUTES.spreadsheet || pathname === ROUTES.reporting;
	return (
		<div className={`shell ${workspace ? 'shell--workspace' : ''}`.trim()}>
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
	);
}
