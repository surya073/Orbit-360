import React from 'react';
import { screen } from '@testing-library/react';
import AppRoutes from '../app/routes/AppRoutes';
import { dashboardRoutes, manager, mockFetch, renderWithProviders } from './helpers';

afterEach(() => {
	delete global.fetch;
});

describe('the sign-in route', () => {
	test('a signed-in user who lands on /login (for example from an old bookmark) goes to the app, not the login form', async () => {
		mockFetch([...dashboardRoutes()]);
		renderWithProviders(<AppRoutes />, { user: manager, route: '/login' });
		expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
		expect(screen.queryByText(/Internal analytics workspace/)).not.toBeInTheDocument();
	});
});
