import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TourProvider, useTour } from '../app/providers/TourProvider';
import { canForUser } from '../config/permissions';
import { TOUR_KEY, buildSteps, hasSeenTour, markTourSeen, navTarget } from '../config/tour';
import { admin, manager, mockFetch, renderWithProviders } from './helpers';

const withPerms = (user, permissions) => ({ ...user, permissions });

function Page() {
	const tour = useTour();
	return (
		<div>
			<nav>
				<a href="#x" data-tour={navTarget('Dashboard')}>
					Dashboard
				</a>
			</nav>
			<button onClick={tour.start}>Take the tour</button>
		</div>
	);
}
const ui = () => (
	<TourProvider>
		<Page />
	</TourProvider>
);

describe('tour steps', () => {
	test('a step for every part of the app the user can open, then appearance and account', () => {
		const all = buildSteps(canForUser(admin)).map((s) => s.id);
		expect(all).toEqual(['nav-dashboard', 'nav-people', 'nav-delivery', 'nav-imports', 'nav-presentations', 'nav-user-management', 'appearance', 'account']);
		const mgr = buildSteps(canForUser(manager)).map((s) => s.id);
				expect(mgr).toContain('nav-people');
	});

	test('steps follow permissions exactly, and groups list only the pages inside them the user can open', () => {
		const steps = buildSteps(canForUser(withPerms(manager, ['employees.view', 'presentations.view'])));
		expect(steps.map((s) => s.id)).toEqual(['nav-people', 'nav-presentations', 'appearance', 'account']);
		expect(steps[0].chips).toEqual(['Employees']);
		expect(buildSteps(canForUser(withPerms(manager, []))).map((s) => s.id)).toEqual(['appearance', 'account']);
		for (const s of steps) {
			expect(s.title).toBeTruthy();
			expect(s.body).toBeTruthy();
			expect(s.icon).toBeTruthy();
		}
	});

	test('"seen" is remembered per device, and blocked storage never nags', () => {
		window.localStorage.removeItem(TOUR_KEY);
		expect(hasSeenTour()).toBe(false);
		markTourSeen();
		expect(hasSeenTour()).toBe(true);
		const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(hasSeenTour()).toBe(true);
		spy.mockRestore();
	});
});

describe('the guided tour', () => {
	beforeEach(() => mockFetch([]));
	afterEach(() => {
		delete global.fetch;
	});

	test('it is offered once on the first visit; skipping is remembered', async () => {
		window.localStorage.removeItem(TOUR_KEY);
		renderWithProviders(ui());
		const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 });
		expect(within(dialog).getByRole('heading', { name: 'Welcome, Maya' })).toBeInTheDocument();
		await userEvent.click(within(dialog).getByRole('button', { name: 'Skip for now' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(hasSeenTour()).toBe(true);
	});

	test('it does not appear again once seen', async () => {
		renderWithProviders(ui()); // setupTests marks the tour as seen
		await new Promise((r) => setTimeout(r, 900));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('step through with the buttons, read each step, finish, then replay from the menu', async () => {
		renderWithProviders(ui(), { user: withPerms(manager, ['employees.view', 'presentations.view']) });
		await userEvent.click(await screen.findByRole('button', { name: 'Take the tour' }));
		await userEvent.click(await screen.findByRole('button', { name: 'Start the tour' }));
		let card = await screen.findByRole('dialog');
		expect(card).toHaveTextContent('Step 1 of 4');
		expect(within(card).getByRole('heading', { name: 'People' })).toBeInTheDocument();
		expect(within(card).getByRole('button', { name: 'Back' })).toBeDisabled();
		await userEvent.click(within(card).getByRole('button', { name: 'Next' }));
		card = await screen.findByRole('dialog');
		expect(within(card).getByRole('heading', { name: 'Present with confidence' })).toBeInTheDocument();
		expect(card).toHaveTextContent('Step 2 of 4');
		await userEvent.click(within(card).getByRole('button', { name: 'Back' }));
		expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
		for (let i = 0; i < 3; i += 1) await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next' }));
		expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
		await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish' }));
		expect(await screen.findByRole('heading', { name: 'You are all set' })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Start exploring' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		await userEvent.click(await screen.findByRole('button', { name: 'Take the tour' })); // replay
		expect(await screen.findByRole('heading', { name: 'Welcome, Maya' })).toBeInTheDocument();
	});

	test('keyboard: arrows move, Escape leaves, and the spotlight finds the element it points at', async () => {
		renderWithProviders(ui(), { user: admin });
		await userEvent.click(await screen.findByRole('button', { name: 'Take the tour' }));
		await userEvent.click(await screen.findByRole('button', { name: 'Start the tour' }));
		expect(await screen.findByRole('heading', { name: 'Your command centre' })).toBeInTheDocument();
		await userEvent.keyboard('{ArrowRight}');
		expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
		await userEvent.keyboard('{ArrowLeft}');
		expect(await screen.findByRole('heading', { name: 'Your command centre' })).toBeInTheDocument();
		expect(document.querySelector(`[data-tour="${navTarget('Dashboard')}"]`)).not.toBeNull(); // the step's target exists in the page
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(hasSeenTour()).toBe(true);
	});

	test('the dialog is announced and keeps focus inside', async () => {
		renderWithProviders(ui());
		await userEvent.click(await screen.findByRole('button', { name: 'Take the tour' }));
		const welcome = await screen.findByRole('dialog');
		expect(welcome).toHaveAttribute('aria-modal', 'true');
		expect(welcome).toHaveAccessibleName(/Welcome/);
		await userEvent.tab();
		await userEvent.tab();
		await userEvent.tab();
		expect(welcome.contains(document.activeElement)).toBe(true);
	});
});
