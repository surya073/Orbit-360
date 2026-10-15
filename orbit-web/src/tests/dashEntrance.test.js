import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import KpiCard from '../components/cards/KpiCard';
import DashboardPage from '../features/dashboard/DashboardPage';
import { CountUp, EntranceContext, chooseEntrance, countUpText, hasNumber } from '../features/dashboard/entrance';
import { dashboardRoutes, manager, mockFetch, renderWithProviders } from './helpers';

describe('count-up text', () => {
	test('keeps decimals, digit grouping and surrounding text, and ends on the exact original', () => {
		expect(countUpText('100', 0)).toBe('0');
		expect(countUpText('33.3', 0)).toBe('0.0');
		expect(countUpText('15.0%', 0)).toBe('0.0%');
		expect(countUpText('1,234', 0)).toBe('0');
		expect(countUpText('133h 20m', 0)).toBe('0h 20m');
		const mid = countUpText('100', 0.5);
		expect(Number(mid)).toBeGreaterThan(0);
		expect(Number(mid)).toBeLessThan(100);
		expect(countUpText('33.3', 0.5)).toMatch(/^\d+\.\d$/); // one decimal throughout
		expect(countUpText('1,23,456', 0.5)).toMatch(/^\d{1,3}(,\d{2})*,?\d*$/); // Indian digit grouping like formatNumber
		for (const text of ['100', '33.3', '15.0%', '1,234', '133h 20m', '3 days']) expect(countUpText(text, 1)).toBe(text);
	});

	test('text without a number is left alone, and bad input never throws', () => {
		expect(countUpText('—', 0.3)).toBe('—');
		expect(countUpText('', 0.3)).toBe('');
		expect(countUpText(null, 0.3)).toBe(null);
		expect(hasNumber('—')).toBe(false);
		expect(hasNumber('12')).toBe(true);
		expect(hasNumber(12)).toBe(false);
	});
});

describe('entrance choice', () => {
	test('the cinematic entrance plays once per session, never with reduced motion', () => {
		expect(chooseEntrance({ seen: false, reducedMotion: false })).toBe('cinematic');
		expect(chooseEntrance({ seen: true, reducedMotion: false })).toBe('quick');
		expect(chooseEntrance({ seen: false, reducedMotion: true })).toBe('quick');
	});
});

describe('CountUp', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	test('starts below the value (never flashes the final), ends on it exactly', () => {
		const { container } = render(<CountUp text="100" enabled />);
		expect(container.textContent).toBe('0');
		act(() => jest.advanceTimersByTime(400));
		const mid = Number(container.textContent);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(100);
		act(() => jest.advanceTimersByTime(1500));
		expect(container.textContent).toBe('100');
	});

	test('it only counts the first time: later values are shown directly', () => {
		const { container, rerender } = render(<CountUp text="100" enabled />);
		act(() => jest.advanceTimersByTime(1600));
		expect(container.textContent).toBe('100');
		rerender(<CountUp text="250" enabled />);
		expect(container.textContent).toBe('250'); // a filter change is not replayed as an animation
	});

	test('it waits for a real value: a dash first, then the count when data arrives', () => {
		const { container, rerender } = render(<CountUp text="—" enabled />);
		expect(container.textContent).toBe('—');
		rerender(<CountUp text="42" enabled />);
		expect(container.textContent).toBe('0');
		act(() => jest.advanceTimersByTime(1600));
		expect(container.textContent).toBe('42');
	});

	test('disabled (reduced motion, other pages, tests): the value is simply shown', () => {
		const { container } = render(<CountUp text="100" enabled={false} />);
		expect(container.textContent).toBe('100');
	});
});

describe('dashboard integration', () => {
	afterEach(() => {
		delete global.fetch;
		window.sessionStorage.clear();
	});

	test('the first visit of a session is cinematic, the next one is quick; real values stay on screen', async () => {
		window.sessionStorage.clear();
		mockFetch([...dashboardRoutes()]);
		const { container, unmount } = renderWithProviders(<DashboardPage />, { user: manager, route: '/' });
		expect(await screen.findByRole('region', { name: 'Billable hours' })).toBeInTheDocument();
		expect(container.querySelector('.dash')).toHaveClass('dash--cinematic');
		await waitFor(() => expect(screen.getByRole('region', { name: 'Employees' })).toHaveTextContent('12')); // count-up never changes the data
		unmount();
		const again = renderWithProviders(<DashboardPage />, { user: manager, route: '/' });
		await screen.findByRole('region', { name: 'Billable hours' });
		expect(again.container.querySelector('.dash')).toHaveClass('dash--quick');
	});

	test('KPI cards outside the cinematic dashboard (presentations) keep their own timing', () => {
		const { container } = render(<KpiCard label="Billable" value="10" delay={120} />);
		expect(container.querySelector('.kpi').style.animationDelay).toBe('120ms');
		const cine = render(
			<EntranceContext.Provider value>
				<KpiCard label="Billable" value="10" delay={120} />
			</EntranceContext.Provider>
		);
		expect(cine.container.querySelector('.kpi').style.animationDelay).toBe(''); // CSS staggers it inside the cinematic dashboard
	});
});
