import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Highlights, { HIGHLIGHT_MS, buildSlides } from '../features/dashboard/signature/Highlights';
import { highlightsFixture } from './helpers';

const done = (data) => ({ status: 'success', data });
const empty = { status: 'success', data: null };
const props = (h = highlightsFixture) => ({ highlights: done(h), overview: empty, projects: empty, product: empty, freshness: empty, preset: 'this_month' });

describe('dashboard highlights', () => {
	test('a slide with nothing to say is left out, and nothing is padded with zeros', () => {
		const slides = buildSlides({ highlights: { ...highlightsFixture, bestAttendance: [], newJoiners: [] }, preset: 'this_month' });
		expect(slides.map((s) => s.id)).toEqual(['top']);
		expect(buildSlides({ highlights: null, preset: 'this_month' })).toEqual([]);
	});

	test('shows the first slide, the dots jump to another one, and there is no button to press', async () => {
		render(<Highlights {...props()} />);
		const card = screen.getByRole('region', { name: 'Highlights' });
		expect(within(card).getByRole('heading', { name: 'Top performers' })).toBeInTheDocument();
		expect(within(card).getAllByRole('tab')).toHaveLength(3);
		await userEvent.click(within(card).getByRole('tab', { name: 'Best attendance' }));
		expect(within(card).getByRole('heading', { name: 'Best attendance' })).toBeInTheDocument();
		expect(within(card).getByText('22 days')).toBeInTheDocument();
		expect(within(card).queryByRole('link')).not.toBeInTheDocument();
	});

	test('moves on by itself, pauses while the pointer is over it, and an empty period says what will appear', async () => {
		jest.useFakeTimers();
		try {
			render(<Highlights {...props()} />);
			const card = screen.getByRole('region', { name: 'Highlights' });
			act(() => jest.advanceTimersByTime(HIGHLIGHT_MS + 50));
			expect(within(card).getByRole('heading', { name: 'Best attendance' })).toBeInTheDocument();
			act(() => {
				card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
			});
			// hovering holds it
			const before = within(card).getByRole('heading', { level: 2 }).textContent;
			const hovered = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
			await hovered.hover(card);
			act(() => jest.advanceTimersByTime(HIGHLIGHT_MS * 3));
			expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(before);
		} finally {
			jest.useRealTimers();
		}
		render(<Highlights {...props({ topPerformers: [], bestAttendance: [], newJoiners: [] })} />);
		expect(screen.getAllByText(/appear here once there is/)[0]).toBeInTheDocument();
	});
});
