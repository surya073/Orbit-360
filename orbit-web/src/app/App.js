import React from 'react';
import { HashRouter } from 'react-router-dom';
import { ToastProvider } from '../components/feedback/ToastProvider';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';

// HashRouter: Catalyst client hosting serves a single index.html with no SPA rewrite rules.
export default function App() {
	return (
		<ThemeProvider>
			<ToastProvider>
				<HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
					<AuthProvider>
						<AppRoutes />
					</AuthProvider>
				</HashRouter>
			</ToastProvider>
		</ThemeProvider>
	);
}
