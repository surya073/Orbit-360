import React, { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KpiCard from '../components/cards/KpiCard';
import BarList from '../components/charts/BarList';
import DonutChart from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';
import StackedBar from '../components/charts/StackedBar';
import { niceMax } from '../components/charts/scale';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import Tabs from '../components/common/Tabs';
import ErrorState from '../components/feedback/ErrorState';
import StateView from '../components/feedback/StateView';
import DateRangeFilter, { isValidPeriod } from '../components/filters/DateRangeFilter';
import DataTable from '../components/tables/DataTable';
import Pagination from '../components/tables/Pagination';
import { ApiClientError } from '../services/apiClient';

describe('KpiCard', () => {
	test('missing values show a dash and the reason, never zero', () => {
		render(<KpiCard label="Billable hours" value={null} metric={{ completeness: 'insufficient_data' }} />);
		const card = screen.getByRole('region', { name: 'Billable hours' });
		expect(within(card).getByText('—')).toBeInTheDocument();
		expect(within(card).queryByText('0')).not.toBeInTheDocument();
		expect(within(card).getByText('No data')).toBeInTheDocument();
	});
	test('a real zero is shown as zero; partial metrics carry a badge with the explanation', () => {
		render(<KpiCard label="Pending" value="0" metric={{ completeness: 'partial', missing: 'pending_approval' }} />);
		const card = screen.getByRole('region', { name: 'Pending' });
		expect(within(card).getByText('0')).toBeInTheDocument();
		expect(within(card).getByText('Partial')).toBeInTheDocument();
		expect(within(card).getByText(/pending approval and are excluded/i)).toBeVisible(); // visible text, not only a tooltip
	});
	test('loading and error states keep the layout and say so', () => {
		const { rerender } = render(<KpiCard label="X" loading />);
		expect(screen.getByRole('region', { name: 'X' })).toHaveAttribute('aria-busy', 'true');
		rerender(<KpiCard label="X" error={new Error('boom')} />);
		expect(screen.getByText('Unavailable')).toBeInTheDocument();
	});
});

describe('charts', () => {
	const series = [{ key: 'a', label: 'Billable', color: 'red' }, { key: 'b', label: 'Other', color: 'blue' }];
	const data = [
		{ x: '2026-10-05', label: '05 Oct', a: 2, b: 1 },
		{ x: '2026-10-12', label: '12 Oct', a: null, b: 3 },
		{ x: '2026-10-19', label: '19 Oct', a: 4, b: null },
	];
	test('line chart mirrors its data in an accessible table and marks gaps as "No data", not zero', () => {
		render(<LineChart data={data} series={series} ariaLabel="Hours over time" yFormat={(v) => `${v}h`} />);
		const table = screen.getByRole('table', { hidden: true });
		const rows = within(table).getAllByRole('row', { hidden: true });
		expect(rows).toHaveLength(4);
		expect(within(rows[2]).getAllByRole('cell', { hidden: true }).map((c) => c.textContent)).toEqual(['12 Oct', 'No data', '3h']);
	});
	test('arrow keys move a crosshair and announce values (keyboard access)', async () => {
		render(<LineChart data={data} series={series} ariaLabel="Hours over time" />);
		const plot = screen.getByRole('img', { name: /Hours over time/ });
		act(() => plot.focus());
		expect(await screen.findByRole('status')).toHaveTextContent('19 Oct');
		await userEvent.keyboard('{ArrowLeft}');
		expect(screen.getByRole('status')).toHaveTextContent('12 Oct');
		expect(screen.getByRole('status')).toHaveTextContent('No data');
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});
	test('single-point series still render without errors', () => {
		render(<LineChart data={[{ x: 'a', a: 1, b: 2 }]} series={series} ariaLabel="one" />);
		expect(screen.getByRole('img', { name: /one/ })).toBeInTheDocument();
	});
	test('bar list shows values as text and a dash for missing values', () => {
		render(<BarList ariaLabel="By project" items={[{ id: 1, label: 'Alpha', value: 5, display: '5h' }, { id: 2, label: 'Beta', value: null }]} />);
		const list = screen.getByRole('list', { name: 'By project' });
		expect(within(list).getByText('5h')).toBeInTheDocument();
		expect(within(list).getByText('—')).toBeInTheDocument();
	});
	test('donut and stacked bar carry their numbers in text/labels', () => {
		render(
			<>
				<DonutChart ariaLabel="By status" centerLabel="projects" segments={[{ label: 'Active', value: 3 }, { label: 'On hold', value: 1 }]} />
				<StackedBar ariaLabel="Mix" segments={[{ label: 'AI', value: 1, color: 'red' }, { label: 'GitHub', value: 3, color: 'blue' }]} />
			</>
		);
		expect(screen.getByRole('img', { name: 'By status: Active 3, On hold 1' })).toBeInTheDocument();
		expect(screen.getByRole('img', { name: /Mix: AI 1, GitHub 3/ })).toBeInTheDocument();
	});
	test('axis ceilings are readable and never zero', () => {
		expect(niceMax(0)).toBe(1);
		expect(niceMax(7)).toBe(10);
		expect(niceMax(23)).toBe(25);
		expect(niceMax(300)).toBe(500);
	});
});

describe('StatusBadge, tables and pagination', () => {
	test('badge carries meaning in text, with a tone class', () => {
		render(<StatusBadge status="approved" />);
		expect(screen.getByText('Approved')).toHaveClass('badge--success');
	});
	test('empty status renders a dash', () => {
		render(<StatusBadge status={null} />);
		expect(screen.getByText('—')).toBeInTheDocument();
	});
	test('table is a focusable scroll region with a caption and actions column', () => {
		render(<DataTable caption="People" columns={[{ key: 'n', label: 'Name' }, { key: 'x', label: 'Other' }]} rows={[{ ROWID: '1', n: 'Asha', x: null }]} rowActions={() => <button>Edit</button>} />);
		expect(screen.getByRole('region', { name: 'People' })).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
	});
	test('pagination reports the range and disables edges', async () => {
		const onPage = jest.fn();
		render(<Pagination meta={{ page: 1, pageSize: 25, total: 60, totalPages: 3 }} onPage={onPage} />);
		expect(screen.getByText(/1–25 of 60/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
		await userEvent.click(screen.getByRole('button', { name: /next/i }));
		expect(onPage).toHaveBeenCalledWith(2);
	});
});

describe('Modal and ConfirmDialog', () => {
	function Harness({ onConfirm }) {
		const [open, setOpen] = useState(false);
		return (
			<>
				<button onClick={() => setOpen(true)}>Open</button>
				{open ? <ConfirmDialog title="Delete it?" message="Sure?" onCancel={() => setOpen(false)} onConfirm={onConfirm} /> : null}
			</>
		);
	}
	test('dialog traps focus, closes on Escape and restores focus to the opener', async () => {
		render(<Harness onConfirm={() => Promise.resolve()} />);
		const opener = screen.getByRole('button', { name: 'Open' });
		await userEvent.click(opener);
		const dialog = screen.getByRole('dialog', { name: 'Delete it?' });
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(dialog.contains(document.activeElement)).toBe(true);
		await userEvent.tab();
		await userEvent.tab();
		await userEvent.tab();
		expect(dialog.contains(document.activeElement)).toBe(true); // Tab wraps inside the dialog
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); // closes after a short exit animation
		expect(opener).toHaveFocus();
	});
	test('a failing confirm action shows the error and stays open', async () => {
		render(<Harness onConfirm={() => Promise.reject(new Error('Server said no'))} />);
		await userEvent.click(screen.getByRole('button', { name: 'Open' }));
		await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
	test('backdrop press closes a dismissible modal', async () => {
		const onClose = jest.fn();
		render(<Modal title="T" onClose={onClose}>body</Modal>);
		const backdrop = screen.getByRole('dialog').parentElement;
		backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});
});

describe('DateRangeFilter', () => {
	function Harness() {
		const [v, setV] = useState({ preset: 'this_month' });
		return (
			<>
				<DateRangeFilter value={v} onChange={setV} />
				<output data-testid="valid">{String(isValidPeriod(v))}</output>
			</>
		);
	}
	test('presets show the resolved dates; custom reveals inputs and rejects an inverted range', async () => {
		render(<Harness />);
		expect(screen.getByLabelText('Resolved dates')).toHaveTextContent('→');
		await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');
		const from = screen.getByLabelText('From');
		const to = screen.getByLabelText('To');
		await userEvent.clear(from);
		await userEvent.type(from, '2026-10-10');
		await userEvent.clear(to);
		await userEvent.type(to, '2026-10-01');
		expect(await screen.findByText('End date is before the start date')).toBeInTheDocument();
		expect(screen.getByTestId('valid')).toHaveTextContent('false');
	});
});

describe('Tabs, StateView and ErrorState', () => {
	test('tabs support arrow-key navigation with roving tabindex', async () => {
		function H() {
			const [v, setV] = useState('a');
			return <Tabs label="Sections" value={v} onChange={setV} tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />;
		}
		render(<H />);
		screen.getByRole('tab', { name: 'A' }).focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '-1');
	});
	test('state view renders loading, error with retry, empty, and success', async () => {
		const reload = jest.fn();
		const { rerender } = render(<StateView res={{ status: 'loading' }}>ok</StateView>);
		expect(screen.getByRole('status')).toBeInTheDocument();
		rerender(<StateView res={{ status: 'error', error: new ApiClientError({ status: 500, code: 'X', message: 'Boom', requestId: 'abcdef123456' }), reload }}>ok</StateView>);
		expect(screen.getByRole('alert')).toHaveTextContent('Boom');
		expect(screen.getByText(/Reference abcdef12/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(reload).toHaveBeenCalled();
		rerender(<StateView res={{ status: 'empty' }} emptyTitle="Nothing" emptyMessage="Add some">ok</StateView>);
		expect(screen.getByText('Nothing')).toBeInTheDocument();
		rerender(<StateView res={{ status: 'success', data: [1] }}>ok</StateView>);
		expect(screen.getByText('ok')).toBeInTheDocument();
	});
	test('unauthorized and forbidden errors are worded for the user and forbidden has no retry', () => {
		const { rerender } = render(<ErrorState error={new ApiClientError({ status: 401, code: 'UNAUTHENTICATED', message: 'x' })} onRetry={() => {}} />);
		expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
		rerender(<ErrorState error={new ApiClientError({ status: 403, code: 'FORBIDDEN', message: 'Another team' })} onRetry={() => {}} />);
		expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
	});
});
