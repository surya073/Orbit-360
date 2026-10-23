import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../components/feedback/ErrorBoundary';

function Boom({ on }) {
	if (on) throw new Error('row value that must not be shown');
	return <p>fine</p>;
}

describe('ErrorBoundary', () => {
	let spy;
	beforeEach(() => {
		spy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => spy.mockRestore());

	test('a page that throws shows a message (never the error text) instead of a blank screen, and recovers on a new address', () => {
		const { rerender } = render(
			<ErrorBoundary resetKey="/a">
				<Boom on />
			</ErrorBoundary>
		);
		expect(screen.getByRole('alert')).toHaveTextContent('could not be drawn');
		expect(screen.queryByText(/row value/)).toBeNull();
		rerender(
			<ErrorBoundary resetKey="/b">
				<Boom on={false} />
			</ErrorBoundary>
		);
		expect(screen.getByText('fine')).toBeInTheDocument();
	});

	test('Try again re-renders the page', async () => {
		let boom = true;
		const Later = () => <Boom on={boom} />;
		render(
			<ErrorBoundary resetKey="/a">
				<Later />
			</ErrorBoundary>
		);
		boom = false;
		await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
		expect(screen.getByText('fine')).toBeInTheDocument();
	});
});
