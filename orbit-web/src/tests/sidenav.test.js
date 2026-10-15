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
		for (const name of ['Dashboard', 'Imports', 'Spreadsheet', 'Presentations', 'Access']) expect(within(nav).getByRole('link', { name: name })).toBeInTheDocument();
		expect(within(nav).getByRole('button', { name: 'People' })).toBeInTheDocument();
		expect(within(nav).getByRole('button', { name: 'Delivery' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
	});

	test('permissions decide what appears: no Access for managers, no empty groups', async () => {
		const { unmount } = renderWithProviders(<SideNav />, { user: manager });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).queryByRole('link', { name: 'Access' })).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<SideNav />, { user: withPerms(manager, ['projects.view']) });
		const only = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(only).getByRole('button', { name: 'Delivery' })).toBeInTheDocument();
		expect(within(only).queryByRole('button', { name: 'People' })).not.toBeInTheDocument();
		expect(within(only).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
	});

	test('the current page is marked, and a group is active when one of its pages is open', async () => {
		renderWithProviders(<SideNav />, { user: admin, route: '/employees' });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).getByRole('button', { name: 'People' })).toHaveClass('active');
		expect(within(nav).getByRole('button', { name: 'Delivery' })).not.toHaveClass('active');
		expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveClass('active');
	});

	test('a group opens as a flyout listing its pages, and Escape closes it', async () => {
		renderWithProviders(<SideNav />, { user: admin });
		const people = await screen.findByRole('button', { name: 'People' });
		expect(people).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(people);
		const flyout = await screen.findByRole('group', { name: 'People pages' });
		for (const page of ['Employees', 'Teams', 'Attendance', 'Leave', 'Performance']) expect(within(flyout).getByRole('link', { name: new RegExp(`^${page}`) })).toBeInTheDocument();
		expect(people).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('group', { name: 'People pages' })).not.toBeInTheDocument();
		expect(people).toHaveAttribute('aria-expanded', 'false');
	});

	test('expanding the rail shows labels, lists the active group inline, and is remembered on this device', async () => {
		const { unmount } = renderWithProviders(<SideNav />, { user: admin, route: '/employees' });
		const toggle = await screen.findByRole('button', { name: 'Expand navigation' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('group', { name: 'People pages' })).not.toBeInTheDocument();
		await userEvent.click(toggle);
		expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveAttribute('aria-expanded', 'true');
		const inline = await screen.findByRole('group', { name: 'People pages' }); // the active group is open inline
		expect(within(inline).getByRole('link', { name: 'Employees' })).toHaveClass('active');
		expect(window.localStorage.getItem('company360.navExpanded')).toBe('1');
		await userEvent.click(screen.getByRole('button', { name: 'People' })); // the active group can be collapsed too
		expect(screen.queryByRole('group', { name: 'People pages' })).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<SideNav />, { user: admin });
		expect(await screen.findByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument(); // remembered
	});

	test('from a module page the Spreadsheet link opens that module', async () => {
		renderWithProviders(<SideNav />, { user: admin, route: '/projects' });
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(within(nav).getByRole('link', { name: 'Spreadsheet' }).getAttribute('href')).toContain('?module=project');
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
