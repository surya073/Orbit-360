import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../app/App';
import { authService } from '../services/authService';
import { admin, dashboardRoutes, errBody, freshnessFixture, manager, mockFetch, okBody, overviewFixture } from './helpers';
import { sessionService } from '../services/sessionService';

jest.mock('../services/authService', () => ({ authService: { isSignedIn: jest.fn(), renderLogin: jest.fn(), signOut: jest.fn() } }));

const signIn = (user) => {
	authService.isSignedIn.mockResolvedValue(true);
	authService.renderLogin.mockResolvedValue();
	return user;
};
const meRoute = (user) => [/^GET \/me/, okBody(user)];

beforeEach(() => {
	window.location.hash = '#/';
	jest.spyOn(sessionService, 'me');
});
afterEach(() => {
	delete global.fetch;
	jest.restoreAllMocks();
});

describe('authentication', () => {
	test('signed-out visitors see the sign-in page and no data is requested', async () => {
		authService.isSignedIn.mockResolvedValue(false);
		authService.renderLogin.mockResolvedValue();
		mockFetch([]);
		render(<App />);
		expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
		expect(global.fetch).not.toHaveBeenCalled();
		expect(authService.renderLogin).toHaveBeenCalledWith('login-container', expect.objectContaining({ cssUrl: expect.stringMatching(/login-iframe-blueberry\.css$/) }));
	});
	test('an unprovisioned user is told so and gets no data', async () => {
		authService.isSignedIn.mockResolvedValue(true);
		mockFetch([[/^GET \/me/, { status: 403, body: errBody(403, 'NOT_PROVISIONED', 'Your account has not been provisioned for Company 360') }]]);
		render(<App />);
		expect(await screen.findByText('Access not available')).toBeInTheDocument();
		expect(screen.getByText(/has not been provisioned/)).toBeInTheDocument();
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
	test('a session that expires mid-use returns to sign-in', async () => {
		authService.isSignedIn.mockResolvedValue(true);
		authService.renderLogin.mockResolvedValue();
		mockFetch([[/^GET \/me/, { status: 401, body: errBody(401, 'UNAUTHENTICATED', 'Authentication required') }]]);
		render(<App />);
		expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
	});
	test('a server failure on startup offers a retry rather than a blank screen', async () => {
		authService.isSignedIn.mockResolvedValue(true);
		mockFetch([[/^GET \/me/, { status: 500, body: errBody(500, 'INTERNAL_ERROR', 'Unexpected server error') }]]);
		render(<App />);
		expect(await screen.findByText('Could not start the app')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
	});
});

describe('shell and dashboard', () => {
	test('manager: compact header with grouped nav, no team switcher, KPIs from backend metrics', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes()]);
		render(<App />);
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
		expect(within(nav).getByRole('button', { name: /People/ })).toBeInTheDocument();
		expect(within(nav).getByRole('button', { name: /Delivery/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Account menu for Maya Rao/ })).toBeInTheDocument();

		const billable = await screen.findByRole('region', { name: 'Billable hours' });
		expect(within(billable).getByText('10')).toBeInTheDocument(); // 600 min = 10 h
		expect(within(billable).getByText('Partial')).toBeInTheDocument(); // pending entries excluded
		expect(within(screen.getByRole('region', { name: 'Employees' })).getByText('12')).toBeInTheDocument();
		expect(screen.queryByLabelText('Team')).not.toBeInTheDocument(); // managers are pinned to their team
		expect(screen.getByText('Team: Delivery')).toBeInTheDocument();
		const urls = global.fetch.calls.map((c) => c.line).filter((l) => l.startsWith('GET /dashboard'));
		expect(urls.every((u) => !u.includes('team_id'))).toBe(true); // managers never send a team
	});

	test('admin sees the team filter and a changed filter refetches with it', async () => {
		signIn(admin);
		mockFetch([meRoute(admin), ...dashboardRoutes()]);
		render(<App />);
		const team = await screen.findByLabelText('Team');
		await screen.findByRole('option', { name: 'Delivery' });
		await userEvent.selectOptions(team, '7');
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/overview') && c.line.includes('team_id=7'))).toBe(true));
		expect(window.location.hash).toContain('team=7'); // filters live in the URL
	});

	test('a failing widget shows its own error and does not break the others', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), [/^GET \/dashboard\/projects/, { status: 503, body: errBody(503, 'QUERY_BUDGET_EXCEEDED', 'Too many queries') }], ...dashboardRoutes()]);
		render(<App />);
		expect(await screen.findByText('Too many queries')).toBeInTheDocument();
		expect(within(await screen.findByRole('region', { name: 'Billable hours' })).getByText('10')).toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Late check-in rate' })).toHaveTextContent('25.0%');
	});

	test('no data: KPIs show dashes with the reason, charts show empty states, nothing is fabricated', async () => {
		signIn(manager);
		const empty = { ...overviewFixture, time: { completeness: 'insufficient_data', billableMinutes: null, nonBillableMinutes: null, totalMinutes: null, billablePercent: null, approvedEntries: 0, excluded: { pending: 0, rejected: 0 } }, attendance: { completeness: 'insufficient_data', lateRatePercent: null, records: 0, unknownCount: 0 }, leave: { completeness: 'insufficient_data', approvedDays: null, approvedHours: null, records: 0 }, headcount: { completeness: 'insufficient_data', total: null, byStatus: {} } };
		mockFetch([
			meRoute(manager),
			[/^GET \/dashboard\/overview/, okBody(empty)],
			[/^GET \/dashboard\/trends/, okBody({ filters: { granularity: 'week' }, truncated: false, time: [], attendance: [] })],
			[/^GET \/dashboard\/projects/, okBody({ status: { completeness: 'insufficient_data', total: null, byStatus: {} }, workload: { completeness: 'insufficient_data', projects: [], projectsWithTime: 0 } })],
			[/^GET \/dashboard\/product/, okBody({ asOf: '2026-10-13', product: { completeness: 'insufficient_data', total: null, byType: {}, byStatus: {}, overdue: null } })],
			[/^GET \/dashboard\/ai-usage/, okBody({ usage: { completeness: 'insufficient_data', tools: [], byCategory: {}, totalRecords: null, missingPeriod: 0 } })],
			[/^GET \/dashboard\/freshness/, okBody({ asOf: 'x', timeEntries: { latestDate: null }, attendance: { latestDate: null }, imports: { lastCompletedAt: null } })],
			[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }])],
		]);
		render(<App />);
		const billable = await screen.findByRole('region', { name: 'Billable hours' });
		await waitFor(() => expect(within(billable).getByText('—')).toBeInTheDocument());
		expect(within(billable).queryByText('0')).not.toBeInTheDocument();
		expect(await screen.findByText('No approved time in this period')).toBeInTheDocument();
		expect(screen.getByText('No attendance recorded in this period')).toBeInTheDocument();
		expect(screen.getByText('No product items yet')).toBeInTheDocument();
		expect(await screen.findByText('No time entries have been recorded yet')).toBeInTheDocument();
	});

	test('an invalid custom range blocks requests and says why', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes()]);
		window.location.hash = '#/?period=custom&from=2026-10-10&to=2026-10-01';
		render(<App />);
		expect(await screen.findByText(/Choose a valid date range/)).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard'))).toBe(false);
	});

	test('navigation menus work by keyboard and the user menu signs out', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes(), [/^GET \/employees/, okBody([], { page: 1, pageSize: 25, total: 0, totalPages: 0 })], [/^GET \/imports\/templates/, okBody([])]]);
		render(<App />);
		const people = await screen.findByRole('button', { name: /People/ });
		await userEvent.click(people);
		expect(people).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{ArrowDown}');
		expect(screen.getByRole('link', { name: /Employees/ })).toHaveFocus();
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('link', { name: /Employees/ })).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
		expect(screen.getByText('maya@example.com', { exact: false })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(authService.signOut).toHaveBeenCalled();
	});

	test('notifications state is honest that the feature is unavailable', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes()]);
		render(<App />);
		await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
		expect(screen.getByText('Not available yet')).toBeInTheDocument();
	});

	test('the mobile drawer lists every destination and closes on Escape', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes()]);
		render(<App />);
		await userEvent.click(await screen.findByRole('button', { name: 'Open navigation' }));
		const drawer = screen.getByRole('dialog', { name: 'Navigation' });
		for (const label of ['Dashboard', 'Employees', 'Time entries', 'Product development', 'Presentations', 'Settings']) {
			expect(within(drawer).getByRole('link', { name: label })).toBeInTheDocument();
		}
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
	});
});

describe('theme from the header', () => {
	test('quick menu switches the whole app theme immediately and it persists', async () => {
		signIn(manager);
		mockFetch([meRoute(manager), ...dashboardRoutes()]);
		render(<App />);
		await userEvent.click(await screen.findByRole('button', { name: 'Appearance' }));
		await userEvent.click(screen.getByRole('radio', { name: 'Black Current' }));
		expect(document.documentElement.dataset.theme).toBe('blackcurrant');
		expect(localStorage.getItem('company360.appearance')).toContain('blackcurrant');
	});
});

test('freshness fixture sanity', () => {
	expect(freshnessFixture.timeEntries.latestDate).toBe('2026-10-12');
	act(() => {});
});
