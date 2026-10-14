import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import PresentationEditor from '../features/presentations/PresentationEditor';
import PresentationPlayer from '../features/presentations/PresentationPlayer';
import PresentationsPage from '../features/presentations/PresentationsPage';
import { __clearLookupCache } from '../hooks/useLookup';
import { admin, dashboardRoutes, errBody, manager, mockFetch, okBody, renderWithProviders } from './helpers';

const meta = (total) => ({ page: 1, pageSize: 25, total, totalPages: Math.ceil(total / 25) });
const deck = (over = {}) => ({
	ROWID: '5',
	title: 'Board review',
	team_id: '7',
	status: 'ready',
	slidesAvailable: true,
	slides: [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'billable_hours' }, { type: 'text', title: 'Thanks', body: 'Questions?' }],
	config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: null }, slides: [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'billable_hours' }, { type: 'text', title: 'Thanks', body: 'Questions?' }] },
	...over,
});

beforeEach(() => __clearLookupCache());
afterEach(() => {
	delete global.fetch;
});

function PlayerRoutes() {
	return (
		<Routes>
			<Route path="/presentations/:id/present" element={<PresentationPlayer />} />
			<Route path="/presentations" element={<div>Presentation list page</div>} />
		</Routes>
	);
}
const playerRoutes = (d = deck()) => [[/^GET \/presentations\/5$/, okBody(d)], [/^POST \/presentations\/5\/presented/, okBody({ ROWID: '5' })], ...dashboardRoutes()];

describe('presentation player', () => {
	test('full-screen deck: slides render live data, keyboard navigates, Esc exits', async () => {
		mockFetch(playerRoutes());
		renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		const dialog = await screen.findByRole('dialog', { name: 'Presentation: Board review' });
		expect(await within(dialog).findByRole('heading', { name: 'Executive summary' })).toBeInTheDocument();
		expect(within(dialog).getByText('Slide 1 of 3')).toBeInTheDocument();
		expect(await within(dialog).findByRole('region', { name: 'Billable hours' })).toBeInTheDocument(); // KPI from the overview endpoint

		await userEvent.keyboard('{ArrowRight}');
		expect(await within(dialog).findByRole('heading', { name: 'Billable hours' })).toBeInTheDocument();
		expect(within(dialog).getByText('Slide 2 of 3')).toBeInTheDocument();
		await userEvent.keyboard('{End}');
		expect(await within(dialog).findByRole('heading', { name: 'Thanks' })).toBeInTheDocument();
		expect(within(dialog).getByText('Questions?')).toBeInTheDocument();
		await userEvent.keyboard('{ArrowRight}'); // stays on the last slide
		expect(within(dialog).getByText('Slide 3 of 3')).toBeInTheDocument();
		await userEvent.keyboard('{Home}');
		expect(await within(dialog).findByRole('heading', { name: 'Executive summary' })).toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		expect(await screen.findByText('Presentation list page')).toBeInTheDocument();
	});

	test('shows the period, data freshness and completeness on the slide', async () => {
		mockFetch(playerRoutes());
		renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		expect(await screen.findByText('This month')).toBeInTheDocument();
		expect(await screen.findByText(/Latest time entry: 12 Oct 2026/)).toBeInTheDocument();
		expect((await screen.findAllByText('Partial')).length).toBeGreaterThan(0); // pending entries excluded
	});

	test('fetches only what the deck needs and records that it was presented once', async () => {
		mockFetch(playerRoutes(deck({ config: { v: 2, period: { preset: 'last_month' }, filters: { teamId: '7', projectId: null }, slides: [{ type: 'section', section: 'ai_usage' }] }, slides: [{ type: 'section', section: 'ai_usage' }] })));
		renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		expect(await screen.findByRole('heading', { name: 'AI usage' })).toBeInTheDocument();
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/ai-usage'))).toBe(true));
		const lines = global.fetch.calls.map((c) => c.line);
		expect(lines.some((l) => l.startsWith('GET /dashboard/overview'))).toBe(false);
		expect(lines.some((l) => l.startsWith('GET /dashboard/projects'))).toBe(false);
		expect(lines.filter((l) => l.startsWith('POST /presentations/5/presented'))).toHaveLength(1);
	});

	test('the saved team/project filters scope an admin\'s data; managers never send a team', async () => {
		const scoped = deck({ config: { v: 2, period: { preset: 'this_month' }, filters: { teamId: '7', projectId: '3' }, slides: [{ type: 'section', section: 'billable_hours' }] }, slides: [{ type: 'section', section: 'billable_hours' }] });
		mockFetch(playerRoutes(scoped));
		const { unmount } = renderWithProviders(<PlayerRoutes />, { user: admin, route: '/presentations/5/present' });
		await screen.findByRole('heading', { name: 'Billable hours' });
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/overview'))).toBe(true));
		const adminCall = global.fetch.calls.find((c) => c.line.startsWith('GET /dashboard/overview')).line;
		expect(adminCall).toContain('team_id=7');
		expect(adminCall).toContain('project_id=3');
		unmount();

		mockFetch(playerRoutes(scoped));
		renderWithProviders(<PlayerRoutes />, { user: manager, route: '/presentations/5/present' });
		await screen.findByRole('heading', { name: 'Billable hours' });
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line.startsWith('GET /dashboard/overview'))).toBe(true));
		expect(global.fetch.calls.find((c) => c.line.startsWith('GET /dashboard/overview')).line).not.toContain('team_id');
	});

	test('a deck the viewer cannot open shows the backend refusal, with an exit', async () => {
		mockFetch([[/^GET \/presentations\/5$/, { status: 404, body: errBody(404, 'NOT_FOUND', 'Not found') }]]);
		renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Exit' }));
		expect(await screen.findByText('Presentation list page')).toBeInTheDocument();
	});

	test('a deck with no slides says so; an unreadable deck is reported', async () => {
		mockFetch(playerRoutes(deck({ slides: [], config: { v: 2, period: { preset: 'this_month' }, filters: {}, slides: [] } })));
		const { unmount } = renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		expect(await screen.findByText('This presentation has no slides.')).toBeInTheDocument();
		unmount();
		mockFetch(playerRoutes(deck({ slidesAvailable: false, config: null, slides: null })));
		renderWithProviders(<PlayerRoutes />, { route: '/presentations/5/present' });
		expect(await screen.findByText('This presentation could not be read.')).toBeInTheDocument();
	});
});

describe('presentations list', () => {
	const rows = [{ ROWID: '5', title: 'Board review', team_id: '7', status: 'ready', last_presented_at: null, MODIFIEDTIME: '2026-10-01 09:00:00' }, { ROWID: '6', title: 'All hands', team_id: null, status: 'draft', MODIFIEDTIME: '2026-10-02 09:00:00' }];
	test('lists decks with team names, present/edit links, and deletes after confirmation', async () => {
		mockFetch([[/^GET \/presentations/, okBody(rows, meta(2))], [/^DELETE \/presentations\/5/, okBody({ deleted: true })], [/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta(1))]]);
		renderWithProviders(<PresentationsPage />);
		expect(await screen.findByText('Board review')).toBeInTheDocument();
		expect(await screen.findByText('Delivery')).toBeInTheDocument();
		expect(screen.getByText('All teams')).toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: 'Present' })[0]).toHaveAttribute('href', '/presentations/5/present');
		await userEvent.click(screen.getByRole('button', { name: 'Delete Board review' }));
		expect(global.fetch.calls.some((c) => c.line.startsWith('DELETE'))).toBe(false);
		await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'DELETE /presentations/5')).toBe(true));
	});
	test('empty and error states', async () => {
		mockFetch([[/^GET \/presentations/, okBody([], meta(0))]]);
		const { unmount } = renderWithProviders(<PresentationsPage />);
		expect(await screen.findByText('No presentations yet')).toBeInTheDocument();
		unmount();
		mockFetch([[/^GET \/presentations/, { status: 403, body: errBody(403, 'FORBIDDEN', 'No access') }]]);
		renderWithProviders(<PresentationsPage />);
		expect(await screen.findByText(/do not have access/i)).toBeInTheDocument();
	});
});

describe('presentation editor', () => {
	function EditorRoutes() {
		return (
			<Routes>
				<Route path="/presentations/new" element={<PresentationEditor />} />
				<Route path="/presentations/:id/edit" element={<PresentationEditor />} />
				<Route path="/presentations" element={<div>Presentation list page</div>} />
			</Routes>
		);
	}
	const lookups = [[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta(1))], [/^GET \/projects/, okBody([{ ROWID: '3', project_name: 'Alpha' }], meta(1))]];

	test('choose, order and remove sections, set the period, and save the contract the backend expects', async () => {
		mockFetch([...lookups, [/^POST \/presentations$/, okBody({ ROWID: '9' })]]);
		renderWithProviders(<EditorRoutes />, { route: '/presentations/new', user: manager });
		await userEvent.type(await screen.findByLabelText(/Title/), 'Monthly review');
		const slides = screen.getAllByRole('listitem').map((li) => li.textContent);
		expect(slides[0]).toMatch(/Executive summary/);
		await userEvent.click(screen.getByRole('button', { name: 'Move Employee overview down' }));
		expect(screen.getAllByRole('listitem')[2].textContent).toMatch(/Employee overview/);
		await userEvent.click(screen.getByRole('button', { name: 'Remove Attendance and leave' }));
		await userEvent.click(screen.getByRole('button', { name: 'AI usage' }));
		await userEvent.selectOptions(screen.getByLabelText('Reporting period'), 'last_month');
		await userEvent.click(screen.getByRole('button', { name: 'Save presentation' }));
		expect(await screen.findByText('Presentation list page')).toBeInTheDocument();
		const post = global.fetch.calls.find((c) => c.line === 'POST /presentations');
		expect(JSON.parse(post.init.body)).toEqual({
			title: 'Monthly review',
			status: 'draft',
			period: { preset: 'last_month' },
			filters: { project_id: null },
			slides: [{ type: 'section', section: 'executive_summary' }, { type: 'section', section: 'employee_overview' }, { type: 'section', section: 'ai_usage' }],
		});
	});

	test('save is disabled until valid; an invalid custom range is explained; backend errors are shown', async () => {
		mockFetch([...lookups, [/^POST \/presentations$/, { status: 422, body: errBody(422, 'VALIDATION_FAILED', 'Input failed validation', [{ field: 'title', code: 'TOO_LONG', message: 'Must be at most 200 characters' }]) }]]);
		renderWithProviders(<EditorRoutes />, { route: '/presentations/new', user: admin });
		const save = await screen.findByRole('button', { name: 'Save presentation' });
		expect(save).toBeDisabled(); // no title yet
		await userEvent.type(screen.getByLabelText(/Title/), 'T');
		expect(save).toBeEnabled();
		await userEvent.selectOptions(screen.getByLabelText('Reporting period'), 'custom');
		await userEvent.clear(screen.getByLabelText('From'));
		await userEvent.type(screen.getByLabelText('From'), '2026-10-10');
		await userEvent.clear(screen.getByLabelText('To'));
		await userEvent.type(screen.getByLabelText('To'), '2026-10-01');
		expect(await screen.findByText('End date is before the start date')).toBeInTheDocument();
		expect(save).toBeDisabled();
		await userEvent.clear(screen.getByLabelText('To'));
		await userEvent.type(screen.getByLabelText('To'), '2026-10-20');
		await userEvent.click(save);
		expect(await screen.findByText('Must be at most 200 characters')).toBeInTheDocument();
	});

	test('editing loads the saved deck and PATCHes it; legacy slides are kept and marked', async () => {
		mockFetch([...lookups, [/^GET \/presentations\/5$/, okBody(deck())], [/^PATCH \/presentations\/5/, okBody({ ROWID: '5' })]]);
		renderWithProviders(<EditorRoutes />, { route: '/presentations/5/edit', user: manager });
		expect(await screen.findByDisplayValue('Board review')).toBeInTheDocument();
		expect(screen.getByText(/legacy slide/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Remove Executive summary' }));
		await userEvent.click(screen.getByRole('button', { name: 'Save presentation' }));
		expect(await screen.findByText('Presentation list page')).toBeInTheDocument();
		const patch = JSON.parse(global.fetch.calls.find((c) => c.line === 'PATCH /presentations/5').init.body);
		expect(patch.slides.map((s) => s.section || s.type)).toEqual(['billable_hours', 'text']);
		expect(patch.team_id).toBeUndefined(); // managers never choose a team
	});
});
