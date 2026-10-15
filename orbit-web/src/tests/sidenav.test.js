import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SideNav from '../components/navigation/SideNav';
import { admin, manager, mockFetch, renderWithProviders } from './helpers';

const withPerms = (user, permissions) => ({ ...user, permissions });

beforeEach(() => mockFetch([]));
afterEach(() => {
	delete global.fetch;
});

describe('sidebar rail', () => {
	test('shows the destinations the user may open, in a labelled Primary navigation', async () => {
		renderWithProviders(<SideNav />, { user: admin });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		for (const name of ['Dashboard', 'Imports', 'Presentations', 'Access']) expect(within(nav).getByRole('link', { name: name })).toBeInTheDocument();
		expect(within(nav).queryByRole('link', { name: 'Spreadsheet' })).not.toBeInTheDocument(); // it opens from Imports
		expect(within(nav).getByRole('link', { name: 'People' })).toBeInTheDocument();
		expect(within(nav).getByRole('link', { name: 'Delivery' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
	});

	test('permissions decide what appears: no Access for managers, no empty groups', async () => {
		const { unmount } = renderWithProviders(<SideNav />, { user: manager });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).queryByRole('link', { name: 'Access' })).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<SideNav />, { user: withPerms(manager, ['projects.view']) });
		const only = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(only).getByRole('link', { name: 'Delivery' })).toBeInTheDocument();
		expect(within(only).queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
		expect(within(only).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
	});

	test('the current page is marked, and a group is active when one of its pages is open', async () => {
		renderWithProviders(<SideNav />, { user: admin, route: '/employees' });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).getByRole('link', { name: 'People' })).toHaveClass('active');
		expect(within(nav).getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'true');
		expect(within(nav).getByRole('link', { name: 'Delivery' })).not.toHaveClass('active');
		expect(within(nav).getByRole('link', { name: 'Delivery' })).not.toHaveAttribute('aria-current');
		expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveClass('active');
	});

	test('a group is one link to its first page; its pages are listed in the top bar, never in the rail', async () => {
		renderWithProviders(<SideNav />, { user: admin });
		const people = await screen.findByRole('link', { name: 'People' });
		expect(people).toHaveAttribute('href', '/employees');
		expect(within(await screen.findByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Delivery' })).toHaveAttribute('href', '/projects');
		expect(people).not.toHaveAttribute('aria-haspopup');
		await userEvent.click(people);
		expect(screen.queryByRole('group', { name: 'People pages' })).not.toBeInTheDocument(); // no flyout or inline list
		expect(screen.queryByRole('link', { name: 'Teams' })).not.toBeInTheDocument();
	});

	test('a group opens its first page the user may see', async () => {
		renderWithProviders(<SideNav />, { user: withPerms(manager, ['teams.view', 'leave.view']) });
		expect(await screen.findByRole('link', { name: 'People' })).toHaveAttribute('href', '/teams');
	});

	test('expanding the rail shows labels and is remembered on this device', async () => {
		const { unmount } = renderWithProviders(<SideNav />, { user: admin, route: '/employees' });
		const toggle = await screen.findByRole('button', { name: 'Expand navigation' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(toggle);
		expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveAttribute('aria-expanded', 'true');
		expect(window.localStorage.getItem('company360.navExpanded')).toBe('1');
		expect(screen.queryByRole('group', { name: 'People pages' })).not.toBeInTheDocument(); // the group is not listed inline either
		unmount();
		renderWithProviders(<SideNav />, { user: admin });
		expect(await screen.findByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument(); // remembered
	});

	test('the spreadsheet belongs to Imports: Imports stays marked while the editor is open', async () => {
		renderWithProviders(<SideNav />, { user: admin, route: '/spreadsheet' });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).getByRole('link', { name: 'Imports' })).toHaveClass('active');
		expect(within(nav).getByRole('link', { name: 'Imports' })).toHaveAttribute('aria-current', 'page');
		expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveClass('active');
	});

	test('the account sits at the bottom of the sidebar and its menu has the profile, themes, layout and sign-out', async () => {
		renderWithProviders(<SideNav />, { user: { ...admin, roleName: 'Administrator' } });
		const account = await screen.findByRole('button', { name: 'Account menu for Ari Admin' });
		expect(account).toHaveAttribute('aria-expanded', 'false');
		expect(within(account).getByText('Ari Admin')).toBeInTheDocument();
		expect(within(account).getByText('Administrator')).toBeInTheDocument();
		await userEvent.click(account);
		const menu = await screen.findByRole('group', { name: 'Account' });
		expect(account).toHaveAttribute('aria-expanded', 'true');
		for (const name of ['Profile', 'Themes', 'Layout', 'Settings', 'Take the tour', 'Sign out']) expect(within(menu).getByText(name)).toBeInTheDocument();
		expect(within(menu).getByRole('link', { name: 'Themes' })).toHaveAttribute('href', '/settings?tab=appearance');
		expect(within(menu).getByRole('link', { name: 'Layout' })).toHaveAttribute('href', '/settings?tab=layout');
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('group', { name: 'Account' })).not.toBeInTheDocument();
		expect(account).toHaveFocus();
	});
});

describe('top bar: pages of the current section', () => {
	const SubNav = require('../components/navigation/SubNav').default;

	test('People pages are listed in the top bar, with the current one marked', async () => {
		renderWithProviders(<SubNav />, { user: admin, route: '/teams' });
		const bar = await screen.findByRole('navigation', { name: 'People pages' });
		const names = within(bar)
			.getAllByRole('link')
			.map((a) => a.textContent);
		expect(names).toEqual(['Employees', 'Teams', 'Attendance', 'Leave', 'Performance']);
		expect(within(bar).getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
		expect(within(bar).getByRole('link', { name: 'Teams' })).toHaveClass('active');
		expect(within(bar).getByRole('link', { name: 'Leave' })).not.toHaveAttribute('aria-current');
	});

	test('Delivery pages appear when a Delivery page is open', async () => {
		renderWithProviders(<SubNav />, { user: admin, route: '/time-entries' });
		const bar = await screen.findByRole('navigation', { name: 'Delivery pages' });
		expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Projects', 'Time entries', 'Product development', 'AI & GitHub usage']);
		expect(within(bar).getByRole('link', { name: 'Time entries' })).toHaveAttribute('aria-current', 'page');
		expect(screen.queryByRole('navigation', { name: 'People pages' })).not.toBeInTheDocument();
	});

	test('a page below a section page (reporting structure) keeps its parent marked', async () => {
		renderWithProviders(<SubNav />, { user: admin, route: '/employees/reporting' });
		expect(within(await screen.findByRole('navigation', { name: 'People pages' })).getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
	});

	test('nothing is shown on pages outside a section, or for pages the user may not open', async () => {
		const { unmount } = renderWithProviders(<SubNav />, { user: admin, route: '/' });
		await new Promise((r) => setTimeout(r, 0));
		expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<SubNav />, { user: withPerms(manager, ['employees.view', 'teams.view']), route: '/employees' });
		const bar = await screen.findByRole('navigation', { name: 'People pages' });
		expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Employees', 'Teams']);
	});
});

describe('phone navigation (offcanvas)', () => {
	const MobileNav = require('../components/navigation/MobileNav').default;
	const { authService } = require('../services/authService');
	const { fireEvent } = require('@testing-library/react');

	test('shows who is signed in, grouped destinations, and the quick actions', async () => {
		renderWithProviders(<MobileNav onClose={() => {}} />, { user: { ...admin, roleName: 'Administrator' } });
		const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
		expect(within(drawer).getByText('Ari Admin')).toBeInTheDocument();
		expect(within(drawer).getByText(/Administrator · all teams/)).toBeInTheDocument();
		expect(within(drawer).getByRole('group', { name: 'People' })).toBeInTheDocument();
		expect(within(drawer).getByRole('group', { name: 'Delivery' })).toBeInTheDocument();
		for (const name of ['Dashboard', 'Employees', 'Projects', 'Imports', 'Access', 'Settings']) expect(within(drawer).getByRole('link', { name })).toBeInTheDocument();
		expect(within(drawer).getByRole('button', { name: 'Take the tour' })).toBeInTheDocument();
		expect(within(drawer).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});

	test('it follows permissions like the rail does', async () => {
		renderWithProviders(<MobileNav onClose={() => {}} />, { user: withPerms(manager, ['projects.view']) });
		const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
		expect(within(drawer).getByRole('link', { name: 'Projects' })).toBeInTheDocument();
		expect(within(drawer).queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument();
		expect(within(drawer).queryByRole('group', { name: 'People' })).not.toBeInTheDocument();
		expect(within(drawer).queryByRole('link', { name: 'Access' })).not.toBeInTheDocument();
	});

	test('it closes on Escape, the close button and a tap outside; the page behind cannot scroll while it is open', async () => {
		const onClose = jest.fn();
		const { unmount } = renderWithProviders(<MobileNav onClose={onClose} />);
		const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
		expect(document.body.style.overflow).toBe('hidden');
		await userEvent.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
		await userEvent.click(within(drawer).getByRole('button', { name: 'Close navigation' }));
		expect(onClose).toHaveBeenCalledTimes(2);
		fireEvent.mouseDown(drawer.parentElement); // the backdrop
		expect(onClose).toHaveBeenCalledTimes(3);
		fireEvent.mouseDown(drawer); // inside the panel does nothing
		expect(onClose).toHaveBeenCalledTimes(3);
		unmount();
		expect(document.body.style.overflow).toBe('');
	});

	test('a swipe to the left closes it; a short one springs back', async () => {
		const onClose = jest.fn();
		renderWithProviders(<MobileNav onClose={onClose} />);
		const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
		const swipe = (dx, dy = 0) => {
			fireEvent.touchStart(drawer, { touches: [{ clientX: 200, clientY: 300 }] });
			fireEvent.touchMove(drawer, { touches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
			fireEvent.touchEnd(drawer);
		};
		swipe(-30);
		swipe(-200, 260); // mostly vertical: a scroll, not a swipe
		expect(onClose).not.toHaveBeenCalled();
		swipe(-140);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('Take the tour closes the menu first; Sign out signs out; focus stays inside', async () => {
		const onClose = jest.fn();
		renderWithProviders(<MobileNav onClose={onClose} />);
		const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
		expect(drawer.contains(document.activeElement)).toBe(true);
		await userEvent.click(within(drawer).getByRole('button', { name: 'Sign out' }));
		expect(authService.signOut).toHaveBeenCalled();
		await userEvent.click(within(drawer).getByRole('button', { name: 'Take the tour' }));
		expect(onClose).toHaveBeenCalled();
		for (let i = 0; i < 30; i += 1) await userEvent.tab();
		expect(drawer.contains(document.activeElement)).toBe(true); // Tab wraps inside the panel
	});
});
