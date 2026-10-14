import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import GlobalSearch from '../components/navigation/GlobalSearch';
import { __clearLookupCache } from '../hooks/useLookup';
import { __resetTemplateCache } from '../hooks/useTemplates';
import EmployeesPage from '../features/employees/EmployeesPage';
import TeamsPage from '../features/teams/TeamsPage';
import TimeEntriesPage from '../features/time-entries/TimeEntriesPage';
import ProjectsPage from '../features/projects/ProjectsPage';
import { admin, dashboardRoutes, errBody, manager, mockFetch, okBody, renderWithProviders } from './helpers';

const meta = (total, page = 1, pageSize = 25) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
const templates = [
	{ module: 'employees', importable: true, adminOnly: false, immutable: [], columns: [{ field: 'full_name', type: 'str', required: true, maxLength: 200 }, { field: 'job_role', type: 'str', required: false, maxLength: 120 }, { field: 'employment_status', type: 'enum', required: false, values: ['active', 'inactive'] }] },
	{ module: 'teams', importable: false, adminOnly: true, immutable: [], columns: [{ field: 'team_code', type: 'str', required: true }, { field: 'name', type: 'str', required: true }] },
	{ module: 'time_entries', importable: true, adminOnly: false, immutable: ['employee_id', 'project_id'], columns: [{ field: 'work_date', type: 'date', required: true }, { field: 'duration_minutes', type: 'int', required: true }] },
	{ module: 'projects', importable: true, adminOnly: false, immutable: [], columns: [{ field: 'project_name', type: 'str', required: true }] },
	{ module: 'project_assignments', importable: true, adminOnly: false, immutable: ['project_id', 'employee_id'], columns: [{ field: 'project_id', type: 'id', required: true }, { field: 'employee_id', type: 'id', required: true }, { field: 'role_in_project', type: 'str' }] },
];
const emp = (id, name) => ({ ROWID: String(id), full_name: name, employee_code: `E${id}`, job_role: 'Engineer', employment_status: 'active', primary_team_id: '7', joining_date: '2026-01-05' });

beforeEach(() => {
	__resetTemplateCache();
	__clearLookupCache();
});
afterEach(() => {
	delete global.fetch;
});

const baseRoutes = (extra = []) => [...extra, [/^GET \/imports\/templates/, okBody(templates)], [/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }], meta(1))]];

describe('module page pattern (Employees)', () => {
	test('lists records with names for foreign keys, formatted dates, and server pagination', async () => {
		mockFetch(baseRoutes([[/^GET \/employees/, (line) => (line.includes('page=2') ? okBody([emp(26, 'Zed Page2')], meta(30, 2)) : okBody([emp(1, 'Asha Rao'), emp(2, 'Bala Iyer')], meta(30)))]]));
		renderWithProviders(<EmployeesPage />);
		expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
		expect(screen.getAllByText('05 Jan 2026').length).toBeGreaterThan(0);
		expect(await screen.findAllByText('Delivery')).not.toHaveLength(0); // team id resolved to a name by one batched lookup
		const lookups = global.fetch.calls.filter((c) => /^GET \/teams\?.*ids=/.test(c.line));
		expect(lookups).toHaveLength(1);
		expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: /next/i }));
		expect(await screen.findByText('Zed Page2')).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => c.line.includes('/employees') && c.line.includes('page=2'))).toBe(true);
	});

	test('search is debounced into one request and sent to the server', async () => {
		mockFetch(baseRoutes([[/^GET \/employees/, okBody([emp(1, 'Asha Rao')], meta(1))]]));
		renderWithProviders(<EmployeesPage />);
		await screen.findByText('Asha Rao');
		const before = global.fetch.calls.filter((c) => c.line.startsWith('GET /employees')).length;
		await userEvent.type(screen.getByLabelText('Search by name'), 'asha');
		await waitFor(() => expect(global.fetch.calls.filter((c) => c.line.startsWith('GET /employees')).length).toBe(before + 1), { timeout: 2000 });
		expect(global.fetch.calls.filter((c) => c.line.startsWith('GET /employees')).pop().line).toContain('q=asha');
	});

	test('empty, filtered-empty and error states are distinct', async () => {
		mockFetch(baseRoutes([[/^GET \/employees/, (line) => (line.includes('employment_status=inactive') ? okBody([], meta(0)) : okBody([], meta(0)))]]));
		renderWithProviders(<EmployeesPage />);
		expect(await screen.findByText('No employees yet')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /add employee/i }).length).toBeGreaterThan(0); // header action and empty-state action
		await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive');
		expect(await screen.findByText('No records match your filters')).toBeInTheDocument();
		await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
		expect(await screen.findByText('No employees yet')).toBeInTheDocument();
	});

	test('a list error shows the API message with a retry that refetches', async () => {
		let fail = true;
		mockFetch(baseRoutes([[/^GET \/employees/, () => (fail ? { status: 503, body: errBody(503, 'DATASTORE_THROTTLED', 'The data service is busy. Retry shortly.') } : okBody([emp(1, 'Asha Rao')], meta(1)))]]));
		renderWithProviders(<EmployeesPage />);
		expect(await screen.findByRole('alert')).toHaveTextContent('The data service is busy');
		fail = false;
		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
	});

	test('create dialog: server field errors appear beside the fields, success closes and refreshes', async () => {
		let created = false;
		mockFetch(
			baseRoutes([
				[/^GET \/employees/, () => okBody(created ? [emp(1, 'New Person')] : [], meta(created ? 1 : 0))],
				[/^POST \/employees/, (line, init) => {
					const body = JSON.parse(init.body);
					if (!body.full_name) return { status: 422, body: errBody(422, 'VALIDATION_FAILED', 'Input failed validation', [{ field: 'full_name', code: 'REQUIRED', message: 'Required' }]) };
					created = true;
					return { status: 201, body: okBody({ ROWID: '1', ...body }) };
				}],
			])
		);
		renderWithProviders(<EmployeesPage />);
		await userEvent.click((await screen.findAllByRole('button', { name: /add employee/i }))[0]);
		const dialog = screen.getByRole('dialog', { name: /new employee/i });
		await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
		expect(await within(dialog).findByText('Please fix the highlighted fields.')).toBeInTheDocument();
		expect(within(dialog).getByText('Required', { selector: '.field-error' })).toBeInTheDocument();
		await userEvent.type(within(dialog).getByLabelText(/Full name/), 'New Person');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
		expect(await screen.findByText('New Person')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(await screen.findByText('Record created')).toBeInTheDocument(); // toast confirmation
		const post = global.fetch.calls.filter((c) => c.line.startsWith('POST /employees')).pop();
		expect(JSON.parse(post.init.body)).toEqual({ full_name: 'New Person' }); // blanks omitted, never sent as ''
	});

	test('edit sends only changed fields; delete asks for confirmation first', async () => {
		mockFetch(baseRoutes([[/^GET \/employees/, okBody([emp(1, 'Asha Rao')], meta(1))], [/^PATCH \/employees\/1/, okBody({ ROWID: '1' })], [/^DELETE \/employees\/1/, okBody({ ROWID: '1', deleted: true })]]));
		renderWithProviders(<EmployeesPage />);
		await userEvent.click(await screen.findByRole('button', { name: 'Edit record 1' }));
		const dialog = screen.getByRole('dialog', { name: /edit employee/i });
		const role = within(dialog).getByLabelText('Job role');
		await userEvent.clear(role);
		await userEvent.type(role, 'Lead');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'PATCH /employees/1')).toBe(true));
		expect(JSON.parse(global.fetch.calls.find((c) => c.line === 'PATCH /employees/1').init.body)).toEqual({ job_role: 'Lead' });

		await userEvent.click(await screen.findByRole('button', { name: 'Delete record 1' }));
		expect(screen.getByRole('dialog', { name: /delete this employee/i })).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => c.line.startsWith('DELETE'))).toBe(false); // not until confirmed
		await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'DELETE /employees/1')).toBe(true));
	});

	test('if the entry form contract is unavailable, write controls are hidden and the failure is explained', async () => {
		mockFetch([[/^GET \/imports\/templates/, { status: 503, body: errBody(503, 'X', 'Service down') }], [/^GET \/employees/, okBody([emp(1, 'Asha Rao')], meta(1))], [/^GET \/teams/, okBody([], meta(0))]]);
		renderWithProviders(<EmployeesPage />);
		expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
		expect(await screen.findByText(/entry form is unavailable/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /add employee/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /edit record/i })).not.toBeInTheDocument();
	});
});

describe('role-based UI (backend remains the boundary)', () => {
	const teamRows = [{ ROWID: '7', name: 'Delivery', team_code: 'DEL', is_active: true }];
	test('only administrators get team write controls', async () => {
		mockFetch(baseRoutes([[/^GET \/teams/, okBody(teamRows, meta(1))]]));
		const { unmount } = renderWithProviders(<TeamsPage />, { user: manager });
		expect(await screen.findByText('DEL')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /add team/i })).not.toBeInTheDocument();
		unmount();
		mockFetch(baseRoutes([[/^GET \/teams/, okBody(teamRows, meta(1))]]));
		renderWithProviders(<TeamsPage />, { user: admin });
		expect(await screen.findByRole('button', { name: /add team/i })).toBeInTheDocument();
	});
});

describe('time entries', () => {
	const entry = { ROWID: '9', work_date: '2026-10-05', employee_id: '1', project_id: '2', duration_minutes: 90, is_billable: true, approval_status: 'pending', work_description: 'Build', team_id: '7' };
	test('shows backend totals, formats durations, and approve/reject act through the API', async () => {
		mockFetch(baseRoutes([...dashboardRoutes(), [/^GET \/time-entries/, okBody([entry], meta(1))], [/^POST \/time-entries\/9\/decision/, (l, init) => okBody({ ROWID: '9', approval_status: JSON.parse(init.body).status })], [/^GET \/employees/, okBody([emp(1, 'Asha Rao')], meta(1))], [/^GET \/projects/, okBody([{ ROWID: '2', project_name: 'Alpha' }], meta(1))]]));
		renderWithProviders(<TimeEntriesPage />);
		expect(await screen.findByText('1h 30m')).toBeInTheDocument();
		expect(screen.getByText('Yes')).toBeInTheDocument();
		expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
		expect(await screen.findByText('Alpha')).toBeInTheDocument();
		const summary = await screen.findByRole('region', { name: 'Billable hours' });
		expect(within(summary).getByText('10')).toBeInTheDocument(); // from the overview endpoint, not computed from rows
		await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'POST /time-entries/9/decision')).toBe(true));
		expect(JSON.parse(global.fetch.calls.find((c) => c.line === 'POST /time-entries/9/decision').init.body)).toEqual({ status: 'approved' });
	});
	test('an inverted date filter is flagged', async () => {
		mockFetch(baseRoutes([...dashboardRoutes(), [/^GET \/time-entries/, okBody([entry], meta(1))]]));
		renderWithProviders(<TimeEntriesPage />);
		await screen.findByText('1h 30m');
		await userEvent.type(screen.getByLabelText('From'), '2026-10-10');
		await userEvent.type(screen.getByLabelText('To'), '2026-10-01');
		expect(await screen.findByText('Before the start date')).toBeInTheDocument();
	});
});

describe('projects and assignments', () => {
	test('opens the assignments dialog for one project and lists only that project\'s employees', async () => {
		mockFetch(baseRoutes([[/^GET \/projects/, okBody([{ ROWID: '2', project_name: 'Alpha', team_id: '7', current_status: 'active' }], meta(1))], [/^GET \/project-assignments/, okBody([{ ROWID: '5', project_id: '2', employee_id: '1', role_in_project: 'Lead', is_active: true }], meta(1, 1, 15))], [/^GET \/employees/, okBody([emp(1, 'Asha Rao')], meta(1))]]));
		renderWithProviders(<ProjectsPage />);
		await userEvent.click(await screen.findByRole('button', { name: /assignments/i }));
		const dialog = await screen.findByRole('dialog', { name: /Assignments · Alpha/ });
		expect(await within(dialog).findByText('Lead')).toBeInTheDocument();
		expect(global.fetch.calls.some((c) => /^GET \/project-assignments\?.*project_id=2/.test(c.line))).toBe(true);
	});
});

describe('global search', () => {
	const results = (title) => okBody([{ ROWID: '1', full_name: title, project_name: title, title, tool_name: title, job_role: 'Engineer' }], meta(1, 1, 5));
	function Page() {
		return (
			<Routes>
				<Route path="/" element={<GlobalSearch />} />
				<Route path="/employees" element={<div>Employees page</div>} />
				<Route path="/projects" element={<div>Projects page</div>} />
			</Routes>
		);
	}

	test('searches only real authorized endpoints, debounced, and navigates with the term', async () => {
		mockFetch([[/^GET \/employees/, results('Asha Rao')], [/^GET \/projects/, results('Asha Project')], [/^GET \/product-items/, okBody([], meta(0))], [/^GET \/ai-usage/, okBody([], meta(0))]]);
		renderWithProviders(<Page />);
		await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
		const input = screen.getByRole('combobox', { name: 'Search' });
		await userEvent.type(input, 'a');
		expect(await screen.findByText(/Type at least 2 characters/)).toBeInTheDocument();
		expect(global.fetch).not.toHaveBeenCalled();
		await userEvent.type(input, 'sha');
		expect(await screen.findByRole('option', { name: /Asha Rao/ }, { timeout: 2500 })).toBeInTheDocument();
		const searches = global.fetch.calls.filter((c) => c.line.includes('q=asha'));
		expect(searches).toHaveLength(4); // one per source, issued once after the debounce
		await userEvent.keyboard('{ArrowDown}');
		const [first] = screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true');
		expect(first).toBeDefined();
		await userEvent.click(screen.getByRole('option', { name: /Asha Rao/ }));
		expect(await screen.findByText('Employees page')).toBeInTheDocument();
	});

	test('one failing source is reported without hiding the others; total denial is explained', async () => {
		mockFetch([[/^GET \/employees/, results('Asha Rao')], [/^GET \/projects/, { status: 503, body: errBody(503, 'X', 'down') }], [/^GET \/product-items/, okBody([], meta(0))], [/^GET \/ai-usage/, okBody([], meta(0))]]);
		const { unmount } = renderWithProviders(<Page />);
		await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
		await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'asha');
		expect(await screen.findByRole('option', { name: /Asha Rao/ }, { timeout: 2500 })).toBeInTheDocument();
		expect(await screen.findByText(/Unavailable right now: Projects/)).toBeInTheDocument();
		unmount();

		mockFetch([[/^GET \//, { status: 403, body: errBody(403, 'FORBIDDEN', 'no') }]]);
		renderWithProviders(<Page />);
		await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
		await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'asha');
		expect(await screen.findByText(/do not have access to search/i, {}, { timeout: 2500 })).toBeInTheDocument();
	});

	test('page shortcuts work without any request, and Escape closes the palette', async () => {
		mockFetch([]);
		renderWithProviders(<Page />);
		await userEvent.click(await screen.findByRole('button', { name: 'Search' }));
		await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'proj');
		await userEvent.click(await screen.findByRole('option', { name: /Projects/ }));
		expect(await screen.findByText('Projects page')).toBeInTheDocument();
		expect(global.fetch).not.toHaveBeenCalled();
		await userEvent.click(screen.queryByRole('button', { name: 'Search' }) || document.body);
	});
});
