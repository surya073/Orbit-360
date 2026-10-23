import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortableList from '../components/common/SortableList';
import { Checkbox, Radio, Switch } from '../components/forms/Choice';
import Field from '../components/forms/Field';
import { DASHBOARD_LAYOUT_KEY, DEFAULT_ORDER, normalizeLayout } from '../config/dashboardLayout';
import DashboardLayoutEditor from '../features/dashboard/DashboardLayoutEditor';
import SettingsPage from '../features/settings/SettingsPage';
import useDashboardLayout from '../hooks/useDashboardLayout';
import { mockFetch, renderWithProviders } from './helpers';

afterEach(() => {
	delete global.fetch;
});

const stored = () => JSON.parse(localStorage.getItem(DASHBOARD_LAYOUT_KEY));
const rowLabels = () => within(screen.getByRole('list', { name: 'Dashboard widgets' })).getAllByRole('listitem').map((li) => within(li).getByRole('button', { name: /^Move .* up$/ }).getAttribute('aria-label').replace(/^Move (.*) up$/, '$1'));

function EditorHarness() {
	const layout = useDashboardLayout();
	return <DashboardLayoutEditor layout={layout} />;
}

describe('dashboard layout model', () => {
	test('defaults, unknown ids dropped, new widgets appended, duplicates collapsed, bad data safe', () => {
		expect(normalizeLayout(null)).toEqual({ order: DEFAULT_ORDER, hidden: [] });
		const n = normalizeLayout({ order: ['insights', 'ghost', 'insights', 'kpis'], hidden: ['ghost', 'kpis', 'kpis'] });
		expect(n.order.slice(0, 2)).toEqual(['insights', 'kpis']);
		expect(n.order).toHaveLength(DEFAULT_ORDER.length);
		expect(n.hidden).toEqual(['kpis']);
		expect(normalizeLayout({ order: 'nope', hidden: 7 })).toEqual({ order: DEFAULT_ORDER, hidden: [] });
	});
});

describe('dashboard layout editor', () => {
	test('move buttons reorder, the order persists and survives a remount', async () => {
		const { unmount } = render(<EditorHarness />);
		expect(rowLabels()[0]).toBe('Key metrics');
		await userEvent.click(screen.getByRole('button', { name: 'Move Key metrics down' }));
		expect(rowLabels().slice(0, 2)).toEqual(['Approved time breakdown', 'Key metrics']);
		expect(stored().order.slice(0, 2)).toEqual(['time-breakdown', 'kpis']);
		unmount();
		render(<EditorHarness />);
		expect(rowLabels().slice(0, 2)).toEqual(['Approved time breakdown', 'Key metrics']);
	});

	test('first/last rows cannot move past the ends', () => {
		render(<EditorHarness />);
		expect(screen.getByRole('button', { name: 'Move Key metrics up' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Move Insights down' })).toBeDisabled();
	});

	test('widgets can be hidden and shown; reset restores the default', async () => {
		render(<EditorHarness />);
		const sw = screen.getByRole('switch', { name: 'Show AI usage' });
		expect(sw).toBeChecked();
		await userEvent.click(sw);
		expect(sw).not.toBeChecked();
		expect(stored().hidden).toEqual(['ai-usage']);
		await userEvent.click(screen.getByRole('button', { name: 'Move Insights up' }));
		await userEvent.click(screen.getByRole('button', { name: /Reset to default layout/ }));
		expect(stored()).toEqual({ order: DEFAULT_ORDER, hidden: [] });
		expect(screen.getByRole('switch', { name: 'Show AI usage' })).toBeChecked();
		expect(screen.getByRole('button', { name: /Reset to default layout/ })).toBeDisabled();
	});

	test('every row has a drag handle with instructions in its label', () => {
		render(<EditorHarness />);
		expect(screen.getAllByRole('button', { name: /^Reorder .*Press space to pick up/ })).toHaveLength(DEFAULT_ORDER.length);
	});

	test('storage failures degrade to session-only without breaking', async () => {
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		render(<EditorHarness />);
		await userEvent.click(screen.getByRole('button', { name: 'Move Key metrics down' }));
		expect(rowLabels()[1]).toBe('Key metrics');
		spy.mockRestore();
	});
});

describe('SortableList', () => {
	test('reports the new id order', async () => {
		const onReorder = jest.fn();
		render(<SortableList label="Things" items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} onReorder={onReorder} renderItem={(it, { handle, moveDown }) => (
			<div>
				{handle}
				<button type="button" onClick={moveDown}>down {it.label}</button>
			</div>
		)} />);
		await userEvent.click(screen.getByRole('button', { name: 'down A' }));
		expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
	});
});

describe('settings page', () => {
	test('the Dashboard tab offers the widget editor, linkable by ?tab=dashboard (and the older ?tab=layout)', async () => {
		mockFetch([]);
		renderWithProviders(<SettingsPage />, { route: '/settings?tab=layout' });
		expect(await screen.findByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('list', { name: 'Dashboard widgets' })).toBeInTheDocument();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	test('three sections (Appearance, Dashboard, Account), and density is on the Appearance screen', async () => {
		mockFetch([]);
		renderWithProviders(<SettingsPage />);
		const list = await screen.findByRole('tablist', { name: 'Settings sections' });
		expect(within(list).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Appearance', 'Dashboard', 'Account']);
		await userEvent.click(screen.getByRole('tab', { name: 'Layout' })); // density is in the shared Layout toggle
		expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
		await userEvent.click(screen.getByRole('radio', { name: 'Compact' }));
		expect(document.documentElement.dataset.density).toBe('compact');
		screen.getByRole('tab', { name: 'Appearance' }).focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
	});
});

describe('form controls', () => {
	test('checkbox, radio and switch are real inputs with visible labels and hints', async () => {
		function Demo() {
			const [on, setOn] = useState(false);
			return (
				<>
					<Checkbox label="Notify me" hint="Weekly digest" checked={on} onChange={(e) => setOn(e.target.checked)} />
					<Radio name="r" label="Option one" defaultChecked />
					<Switch label="Dark mode" disabled />
				</>
			);
		}
		render(<Demo />);
		const cb = screen.getByRole('checkbox', { name: /Notify me/ });
		expect(cb).toHaveAccessibleDescription('Weekly digest');
		await userEvent.click(screen.getByText('Notify me'));
		expect(cb).toBeChecked();
		expect(screen.getByRole('radio', { name: 'Option one' })).toBeChecked();
		expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeDisabled();
	});

	test('Field wires labels, error (announced) and success states', () => {
		render(
			<>
				<Field label="Email" error="Enter a valid email">{(p) => <input {...p} />}</Field>
				<Field label="Code" success="Looks good">{(p) => <input {...p} />}</Field>
				<Field label="Notes" hint="Optional">{(p) => <textarea {...p} readOnly />}</Field>
			</>
		);
		const email = screen.getByLabelText('Email');
		expect(email).toHaveAttribute('aria-invalid', 'true');
		expect(email).toHaveAccessibleDescription('Enter a valid email');
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
		const code = screen.getByLabelText('Code');
		expect(code).toHaveAttribute('data-valid', 'true');
		expect(code).toHaveAccessibleDescription('Looks good');
		expect(screen.getByLabelText('Notes')).toHaveAttribute('readonly');
	});
});
