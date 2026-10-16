import { optionValues, pickOption } from './pickOption';
import React, { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../components/feedback/ToastProvider';
import LookupSelect from '../components/forms/LookupSelect';
import Pagination from '../components/tables/Pagination';
import useClientPagination from '../hooks/useClientPagination';
import { okBody, mockFetch } from './helpers';

describe('Pagination with rows per page', () => {
	test('offers 10/20/50/100, reports changes, and shows the range the server returned', async () => {
		const onPageSize = jest.fn();
		const onPage = jest.fn();
		render(<Pagination meta={{ page: 2, pageSize: 20, total: 55, totalPages: 3 }} onPage={onPage} pageSize={20} onPageSize={onPageSize} />);
		const select = screen.getByRole('combobox', { name: 'Rows per page' });
		expect(await optionValues(select)).toEqual(['10', '20', '50', '100']);
		expect(screen.getByText(/21–40 of 55/)).toBeInTheDocument();
		await pickOption(select, '50');
		expect(onPageSize).toHaveBeenCalledWith(50);
		await userEvent.click(screen.getByRole('button', { name: 'Last page' }));
		expect(onPage).toHaveBeenCalledWith(3);
		await userEvent.click(screen.getByRole('button', { name: 'First page' }));
		expect(onPage).toHaveBeenCalledWith(1);
	});

	test('the plain pager still works without a size choice', () => {
		render(<Pagination meta={{ page: 1, pageSize: 25, total: 3, totalPages: 1 }} onPage={() => {}} />);
		expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
		expect(screen.getByText(/1–3 of 3/)).toBeInTheDocument();
	});

	test('client-side pagination slices a loaded list and resets to page 1 when the size changes', async () => {
		const rows = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }));
		function Demo() {
			const p = useClientPagination(rows, 'test-table', 10);
			return (
				<>
					<ul>{p.rows.map((r) => <li key={r.id}>row {r.id}</li>)}</ul>
					<Pagination {...p.pagination} />
				</>
			);
		}
		render(<Demo />);
		expect(screen.getAllByRole('listitem')).toHaveLength(10);
		await userEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(screen.getByText('row 11')).toBeInTheDocument();
		await pickOption(screen.getByRole('combobox', { name: 'Rows per page' }), '20');
		expect(screen.getAllByRole('listitem')).toHaveLength(20);
		expect(screen.getByText('row 1')).toBeInTheDocument();
	});
});

describe('toasts', () => {
	function Trigger({ tone, message = 'Record created' }) {
		const { notify } = useToast();
		return <button onClick={() => notify(message, tone)}>go</button>;
	}
	const open = async (tone, message) => {
		render(
			<ToastProvider>
				<Trigger tone={tone} message={message} />
			</ToastProvider>
		);
		await userEvent.click(screen.getByRole('button', { name: 'go' }));
	};

	test('a plain confirmation is a success toast with a title, the message and a dismiss button', async () => {
		await open(undefined);
		const toast = screen.getByRole('status');
		expect(toast).toHaveClass('toast--success');
		expect(within(toast).getByText('Success')).toBeInTheDocument();
		expect(within(toast).getByText('Record created')).toBeInTheDocument();
		await userEvent.click(within(toast).getByRole('button', { name: 'Dismiss notification' }));
		await waitFor(() => expect(screen.queryByText('Record created')).not.toBeInTheDocument());
	});

	test('errors are announced assertively and warnings and notes have their own treatment', async () => {
		function Both() {
			const { notify } = useToast();
			return (
				<>
					<button onClick={() => notify('Could not save', 'error')}>fail</button>
					<button onClick={() => notify('Check this', 'warning')}>warn</button>
				</>
			);
		}
		render(
			<ToastProvider>
				<Both />
			</ToastProvider>
		);
		await userEvent.click(screen.getByRole('button', { name: 'fail' }));
		expect(screen.getByRole('alert')).toHaveClass('toast--error');
		await userEvent.click(screen.getByRole('button', { name: 'warn' }));
		expect(screen.getByText('Check this').closest('.toast')).toHaveClass('toast--warning');
	});

	test('toasts leave on their own after a while', async () => {
		jest.useFakeTimers();
		try {
			await act(async () => {
				render(
					<ToastProvider>
						<Trigger tone="info" message="Copied 3 cells" />
					</ToastProvider>
				);
			});
			await act(async () => {
				screen.getByRole('button', { name: 'go' }).click();
			});
			expect(screen.getByText('Copied 3 cells')).toBeInTheDocument();
			await act(async () => {
				jest.advanceTimersByTime(5000);
			});
			await act(async () => {
				jest.advanceTimersByTime(400);
			});
			expect(screen.queryByText('Copied 3 cells')).not.toBeInTheDocument();
		} finally {
			jest.useRealTimers();
		}
	});
});

describe('searchable dropdown (foreign-key picker)', () => {
	const teams = [{ ROWID: '7', name: 'Delivery' }, { ROWID: '8', name: 'Platform' }];
	function Harness({ initial = '' }) {
		const [v, setV] = useState(initial);
		return (
			<>
				<LookupSelect column="team_id" value={v} onChange={setV} controlProps={{ 'aria-label': 'Team' }} />
				<output data-testid="value">{v}</output>
			</>
		);
	}
	const teamCalls = () => global.fetch.calls.filter((c) => /^GET \/teams/.test(c.line));
	beforeEach(() =>
		mockFetch([
			[/^GET \/teams\?.*ids=/, (line) => okBody(teams.filter((t) => line.includes(`ids=${t.ROWID}`)))],
			[/^GET \/teams\?.*q=plat/, okBody([teams[1]])],
			[/^GET \/teams/, okBody(teams)],
		])
	);
	afterEach(() => {
		delete global.fetch;
	});

	test('requests nothing until it is opened, then lists options and picks one with the mouse', async () => {
		render(<Harness />);
		expect(teamCalls()).toHaveLength(0);
		await userEvent.click(screen.getByRole('combobox', { name: 'Team' }));
		const list = await screen.findByRole('listbox');
		expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Delivery', 'Platform']);
		await userEvent.click(within(list).getByRole('option', { name: 'Platform' }));
		expect(screen.getByTestId('value')).toHaveTextContent('8');
		expect(screen.getByRole('combobox', { name: 'Team' })).toHaveValue('Platform');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
	});

	test('typing searches on the server (one request after a pause) and the keyboard picks the match', async () => {
		render(<Harness />);
		const box = screen.getByRole('combobox', { name: 'Team' });
		await userEvent.click(box);
		await screen.findByRole('listbox');
		await userEvent.type(box, 'plat');
		await waitFor(() => expect(teamCalls().filter((c) => /q=plat/.test(c.line))).toHaveLength(1));
		await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
		await userEvent.keyboard('{Enter}');
		expect(screen.getByTestId('value')).toHaveTextContent('8');
	});

	test('shows the chosen name for an existing value, clears it, and Escape closes only the list', async () => {
		const onKey = jest.fn();
		render(
			<div onKeyDown={onKey}>
				<Harness initial="7" />
			</div>
		);
		await waitFor(() => expect(screen.getByRole('combobox', { name: 'Team' })).toHaveValue('Delivery'));
		await userEvent.click(screen.getByRole('combobox', { name: 'Team' }));
		await screen.findByRole('listbox');
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
		expect(onKey).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' })); // a surrounding dialog would not close
		await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
		expect(screen.getByTestId('value')).toHaveTextContent('');
	});

	test('a search with no results says so', async () => {
		mockFetch([[/^GET \/teams/, okBody([])]]);
		render(<Harness />);
		await userEvent.click(screen.getByRole('combobox', { name: 'Team' }));
		expect(await screen.findByText(/No teams found/)).toBeInTheDocument();
	});
});
