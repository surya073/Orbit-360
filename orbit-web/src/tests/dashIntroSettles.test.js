import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { useDashboardEntrance } from '../features/dashboard/entrance';

function Probe() {
	return <p>{useDashboardEntrance()}</p>;
}

describe('dashboard intro', () => {
	afterEach(() => {
		jest.useRealTimers();
		window.sessionStorage.clear();
	});

	test('the first visit plays the intro, then settles so later re-renders never replay its delayed animations', () => {
		jest.useFakeTimers();
		window.sessionStorage.clear();
		render(<Probe />);
		expect(screen.getByText('cinematic')).toBeInTheDocument();
		act(() => {
			jest.advanceTimersByTime(4600);
		});
		expect(screen.getByText('settled')).toBeInTheDocument();
	});

	test('a later visit in the same session is quick from the start', () => {
		window.sessionStorage.setItem('company360.dashIntro', '1');
		render(<Probe />);
		expect(screen.getByText('quick')).toBeInTheDocument();
	});
});
