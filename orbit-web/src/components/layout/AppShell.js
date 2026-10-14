import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import LoadingState from '../feedback/LoadingState';
import AppHeader from '../navigation/AppHeader';

export default function AppShell() {
	const { pathname } = useLocation();
	return (
		<div className="shell">
			<a href="#main" className="skip-link">
				Skip to content
			</a>
			<AppHeader />
			<main id="main" className="main" tabIndex={-1}>
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
