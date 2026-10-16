import { pickOption } from './pickOption';
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { RequirePermission } from '../app/routes/guards';
import { visibleNav, flatDestinations, firstDestination } from '../config/navigation';
import { canForRole, canForUser } from '../config/permissions';
import { __clearLookupCache } from '../hooks/useLookup';
import { __resetTemplateCache } from '../hooks/useTemplates';
import AccessPage from '../features/access/AccessPage';
import { allKeys, columnFull, describeKey, diff, moduleFull, setAll, setColumn, setModule, summarize, toggle } from '../features/access/accessModel';
import EmployeesPage from '../features/employees/EmployeesPage';
import TeamsPage from '../features/teams/TeamsPage';
import SpreadsheetPage from '../features/spreadsheet/SpreadsheetPage';
import { admin, errBody, manager, mockFetch, okBody, renderWithProviders } from './helpers';

const catalog = {
	actions: [
		{ key: 'view', label: 'View', description: 'See' },
		{ key: 'create', label: 'Create', description: 'Add' },
		{ key: 'edit', label: 'Edit', description: 'Change' },
		{ key: 'delete', label: 'Delete', description: 'Remove' },
		{ key: 'approve', label: 'Approve', description: 'Approve' },
		{ key: 'manage_roles', label: 'Manage roles', description: 'Roles' },
		{ key: 'manage_users', label: 'Manage users', description: 'Users' },
	],
	modules: [
		{ key: 'employees', label: 'Employees', group: 'People', description: 'Directory', actions: ['view', 'create', 'edit', 'delete'] },
		{ key: 'time_entries', label: 'Time entries', group: 'Delivery', description: 'Hours', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
		{ key: 'access', label: 'Access & Permissions', group: 'Administration', description: 'Roles and users', actions: ['view', 'manage_roles', 'manage_users'] },
	],
};
const meta = (total) => ({ page: 1, pageSize: 20, total, totalPages: 1 });
const withPerms = (user, permissions, extra = {}) => ({ ...user, permissions, ...extra });

describe('permission model (pure)', () => {
	test('turning anything on turns View on; turning View off turns the module off', () => {
		let s = toggle(new Set(), catalog, 'employees', 'edit');
		expect([...s].sort()).toEqual(['employees.edit', 'employees.view']);
		s = toggle(s, catalog, 'employees', 'delete');
		expect(s.has('employees.delete')).toBe(true);
		s = toggle(s, catalog, 'employees', 'edit'); // off: only that action
		expect(s.has('employees.edit')).toBe(false);
		expect(s.has('employees.view')).toBe(true);
		s = toggle(s, catalog, 'employees', 'view'); // off: everything in the module
		expect([...s]).toEqual([]);
		expect(toggle(new Set(), catalog, 'employees', 'approve').size).toBe(0); // an action the module does not have is ignored
	});

	test('bulk selection by row, by column and everything', () => {
		const all = setAll(catalog, true);
		expect(all.size).toBe(allKeys(catalog).length);
		expect(moduleFull(all, catalog, 'employees')).toBe(true);
		expect(columnFull(all, catalog, 'approve')).toBe(true);
		const noEmployees = setModule(all, catalog, 'employees', false);
		expect(moduleFull(noEmployees, catalog, 'employees')).toBe(false);
		expect(noEmployees.has('time_entries.edit')).toBe(true);
		const noEdit = setColumn(all, catalog, 'edit', false);
		expect(noEdit.has('employees.edit')).toBe(false);
		expect(noEdit.has('employees.view')).toBe(true);
		const noView = setColumn(all, catalog, 'view', false); // View off removes the whole module
		expect([...noView].filter((k) => k.startsWith('employees.'))).toEqual([]);
		expect(columnFull(setColumn(new Set(), catalog, 'create', true), catalog, 'create')).toBe(true);
		expect(setAll(catalog, false).size).toBe(0);
	});

	test('changes are described in plain words', () => {
		const d = diff(new Set(['employees.view', 'employees.edit']), new Set(['employees.view', 'time_entries.approve']));
		expect(d).toEqual({ added: ['time_entries.approve'], removed: ['employees.edit'] });
		expect(describeKey(catalog, 'time_entries.approve')).toBe('Approve Time entries');
		expect(summarize(new Set(['employees.view', 'employees.edit']), catalog)).toEqual([{ module: 'employees', label: 'Employees', group: 'People', actions: ['View', 'Edit'] }]);
	});
});

describe('what the user sees follows their permissions', () => {
	test('a session without a permission list falls back to the two original roles', () => {
		expect(canForUser({ role: 'admin' })('access.manage_users')).toBe(true);
		expect(canForUser({ role: 'manager' })('employees.edit')).toBe(true);
		expect(canForUser({ role: 'manager' })('teams.create')).toBe(false);
		expect(canForUser({ role: 'manager' })('access.view')).toBe(false);
		expect(canForUser({ role: 'manager', permissions: ['employees.view'] })('employees.edit')).toBe(false); // a real list always wins
		expect(canForUser(null)('employees.view')).toBe(false);
		expect(canForRole('stranger')('dashboard.view')).toBe(false);
	});

	test('navigation shows only what is permitted; empty groups disappear; home falls back to the first allowed page', () => {
		const can = canForUser({ permissions: ['employees.view', 'projects.view'] });
		expect(flatDestinations(can).map((d) => d.label)).toEqual(['Employees', 'Projects']);
		expect(visibleNav(can).map((n) => n.label)).toEqual(['People', 'Delivery']);
		expect(visibleNav(canForUser({ permissions: ['projects.view'] })).map((n) => n.label)).toEqual(['Delivery']);
		expect(firstDestination(can)).toBe('/employees');
		expect(firstDestination(canForUser({ permissions: [] }))).toBeNull();
		expect(visibleNav(canForUser({ permissions: ['access.view'] })).map((n) => n.label)).toEqual(['Access']);
	});

	test('a page behind a permission shows a notice instead of the page (the API refuses the calls too)', async () => {
		mockFetch([]);
		const ui = (
			<Routes>
				<Route path="/" element={<RequirePermission permission={['employees.view', 'reporting.view']}>secret page</RequirePermission>} />
			</Routes>
		);
		const { unmount } = renderWithProviders(ui, { user: withPerms(manager, ['employees.view']) });
		expect(await screen.findByRole('alert')).toHaveTextContent(/does not have access to this page/i);
		expect(screen.queryByText('secret page')).not.toBeInTheDocument();
		unmount();
		renderWithProviders(ui, { user: withPerms(manager, ['employees.view', 'reporting.view']) });
		expect(await screen.findByText('secret page')).toBeInTheDocument();
	});
});

describe('record pages: every control follows its own permission', () => {
	const templates = [
		{ module: 'employees', importable: true, adminOnly: false, immutable: [], columns: [{ field: 'full_name', type: 'str', required: true }] },
		{ module: 'teams', importable: false, adminOnly: true, immutable: [], columns: [{ field: 'name', type: 'str', required: true }] },
	];
	const routes = () => [
		[/^GET \/imports\/templates/, okBody(templates)],
		[/^GET \/employees/, okBody([{ ROWID: '1', full_name: 'Asha Rao', employment_status: 'active', primary_team_id: '7' }], meta(1))],
		[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery', team_code: 'T7', is_active: true }], meta(1))],
	];
	beforeEach(() => {
		__resetTemplateCache();
		__clearLookupCache();
	});
	afterEach(() => {
		delete global.fetch;
	});

	test('view only: no Add, Edit or Delete', async () => {
		mockFetch(routes());
		renderWithProviders(<EmployeesPage />, { user: withPerms(manager, ['employees.view']) });
		await screen.findByText('Asha Rao');
		expect(screen.queryByRole('button', { name: /add employee/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /edit record/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /delete record/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /spreadsheet/i })).not.toBeInTheDocument();
	});

	test('Edit without Delete shows only the Edit button; Create adds the Add button', async () => {
		mockFetch(routes());
		const { unmount } = renderWithProviders(<EmployeesPage />, { user: withPerms(manager, ['employees.view', 'employees.edit']) });
		await screen.findByText('Asha Rao');
		expect(screen.getByRole('button', { name: /edit record 1/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /delete record/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /add employee/i })).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<EmployeesPage />, { user: withPerms(manager, ['employees.view', 'employees.create', 'employees.delete']) });
		await screen.findByText('Asha Rao');
		expect(screen.getAllByRole('button', { name: /add employee/i }).length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: /delete record 1/i })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /edit record/i })).not.toBeInTheDocument();
	});

	test('the Teams page: managers cannot add teams; a role granted Create can', async () => {
		mockFetch(routes());
		const { unmount } = renderWithProviders(<TeamsPage />, { user: manager });
		await screen.findByText('Delivery');
		expect(screen.queryByRole('button', { name: /add team/i })).not.toBeInTheDocument();
		unmount();
		renderWithProviders(<TeamsPage />, { user: withPerms(manager, ['teams.view', 'teams.create']) });
		await screen.findByText('Delivery');
		expect(screen.getAllByRole('button', { name: /add team/i }).length).toBeGreaterThan(0);
	});

	test('the spreadsheet follows the field contract of the signed-in user', async () => {
		mockFetch([
			[/^GET \/imports\/templates/, okBody([{ ...templates[0], permissions: { view: true, create: true, edit: false, delete: false } }])],
			[/^GET \/employees/, okBody([{ ROWID: '1', full_name: 'Asha Rao' }], meta(1))],
			[/^GET \/teams/, okBody([], meta(0))],
		]);
		renderWithProviders(<SpreadsheetPage />, { user: withPerms(manager, ['spreadsheet.view', 'employees.view', 'employees.create']), route: '/spreadsheet?module=employees' });
		await screen.findByText('Asha Rao');
		expect(screen.getByRole('button', { name: 'Add row' })).toBeEnabled(); // Create lets you add rows
		expect(screen.getByRole('button', { name: 'Delete selected rows' })).toBeDisabled(); // no Delete permission
		expect(screen.getByRole('button', { name: /Download the visible rows/ })).toBeDisabled(); // no spreadsheet.export
	});
});

describe('Access & Permissions page', () => {
	const roles = (over = {}) => ({
		tablesReady: true,
		you: { roleKey: 'admin', canManageRoles: true, canManageUsers: true },
		roles: [
			{ id: '11', key: 'admin', name: 'Administrator', description: 'Full access', scopeType: 'all_teams', isSystem: true, isProtected: true, isActive: true, permissions: allKeys(catalog), revoked: [], source: 'database', userCount: 1 },
			{ id: null, key: 'manager', name: 'Manager', description: 'Works with one team', scopeType: 'own_team', isSystem: true, isProtected: false, isActive: true, permissions: ['employees.view', 'employees.edit', 'time_entries.view'], revoked: ['employees.delete'], source: 'default', userCount: 2 },
		],
		...over,
	});
	const people = [
		{ id: '1', email: 'ari@example.com', displayName: 'Ari Admin', teamId: null, isActive: true, roleId: '11', roleKey: 'admin', roleName: 'Administrator', roleSource: 'default' },
		{ id: '2', email: 'maya@example.com', displayName: 'Maya Rao', teamId: '7', isActive: true, roleId: null, roleKey: 'manager', roleName: 'Manager', roleSource: 'default' },
	];
	const api = (data = roles(), extra = []) => [
		...extra,
		[/^GET \/access\/catalog/, okBody(catalog)],
		[/^GET \/access\/roles/, okBody(data)],
		[/^GET \/access\/users/, okBody(people, meta(2))],
		[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery' }, { ROWID: '8', name: 'Platform' }], meta(2))],
	];
	const adminUser = withPerms(admin, [...allKeys(catalog), 'teams.view'], { roleKey: 'admin', scopeType: 'all_teams' });
	afterEach(() => {
		delete global.fetch;
	});

	test('the overview shows roles, modules and who can do what', async () => {
		mockFetch(api());
		renderWithProviders(<AccessPage />, { user: adminUser });
		expect(await screen.findByRole('heading', { name: 'Access & Permissions' })).toBeInTheDocument();
		const grid = await screen.findByRole('region', { name: 'Role and module overview' });
		expect(within(grid).getByText('Administrator')).toBeInTheDocument();
		expect(within(grid).getAllByText('Full').length).toBeGreaterThan(0);
		expect(within(grid).getByText('View, Edit')).toBeInTheDocument(); // the Manager's Employees access
		expect(screen.queryByText(/access tables have not been created/i)).not.toBeInTheDocument();
	});

	test('before the tables exist: a clear setup note, and nothing can be edited', async () => {
		mockFetch(api(roles({ tablesReady: false })));
		renderWithProviders(<AccessPage />, { user: adminUser, route: '/access' });
		expect(await screen.findByText(/access tables have not been created yet/i)).toBeInTheDocument();
		expect(screen.getByText(/data\/access-permissions-schema\.md/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('tab', { name: 'Roles & permissions' }));
		expect(await screen.findByRole('note')).toHaveTextContent(/cannot be changed/i);
		expect(screen.getByRole('button', { name: 'New role' })).toBeDisabled();
		const matrix = screen.getByRole('region', { name: /Permissions of/ });
		expect(within(matrix).getAllByRole('checkbox').every((c) => c.disabled)).toBe(true);
	});

	test('the Administrator role is protected: its permissions cannot be edited', async () => {
		mockFetch(api());
		renderWithProviders(<AccessPage />, { user: adminUser, route: '/access?tab=roles' });
		expect(await screen.findByText(/Administrator role is protected/i)).toBeInTheDocument();
		const matrix = screen.getByRole('region', { name: 'Permissions of Administrator' });
		expect(within(matrix).getAllByRole('checkbox').every((c) => c.disabled && c.checked)).toBe(true);
		expect(screen.queryByRole('button', { name: 'Review and save' })).not.toBeInTheDocument();
	});

	test('editing a role: toggle, review exactly what changes, confirm, and the API gets the new set', async () => {
		mockFetch(api(roles(), [[/^PUT \/access\/roles\/manager\/permissions/, okBody({ id: '12', granted: 1, revoked: 0 })]]));
		renderWithProviders(<AccessPage />, { user: adminUser, route: '/access?tab=roles' });
		await userEvent.click(await screen.findByRole('button', { name: /^Manager/ }));
		const matrix = await screen.findByRole('region', { name: 'Permissions of Manager' });
		expect(within(matrix).getByRole('checkbox', { name: 'Employees: Edit' })).toBeChecked();
		expect(within(matrix).getByRole('checkbox', { name: 'Employees: Delete' })).not.toBeChecked();
		expect(screen.getByRole('button', { name: 'Review and save' })).toBeDisabled(); // nothing changed yet
		await userEvent.click(within(matrix).getByRole('checkbox', { name: 'Time entries: Approve' }));
		expect(within(matrix).getByRole('checkbox', { name: 'Time entries: Approve' })).toBeChecked();
		await userEvent.click(within(matrix).getByRole('checkbox', { name: 'Employees: Edit' })); // off
		expect(screen.getByRole('status')).toHaveTextContent('1 to add, 1 to remove');
		await userEvent.click(screen.getByRole('button', { name: 'Review and save' }));
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Added (1): Approve Time entries');
		expect(dialog).toHaveTextContent('Removed (1): Edit Employees');
		expect(dialog).toHaveTextContent('2 people hold this role');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Save permissions' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'PUT /access/roles/manager/permissions')).toBe(true));
		const put = global.fetch.calls.find((c) => c.line === 'PUT /access/roles/manager/permissions');
		expect(JSON.parse(put.init.body).permissions.sort()).toEqual(['employees.view', 'time_entries.approve', 'time_entries.view']);
		expect(await screen.findByText(/Permissions of “Manager” saved/)).toBeInTheDocument();
	});

	test('bulk buttons select a whole row or column; Reset discards the draft', async () => {
		mockFetch(api());
		renderWithProviders(<AccessPage />, { user: adminUser, route: '/access?tab=roles' });
		await userEvent.click(await screen.findByRole('button', { name: /^Manager/ }));
		const matrix = await screen.findByRole('region', { name: 'Permissions of Manager' });
		await userEvent.click(within(matrix).getByRole('button', { name: 'Select everything for Time entries' }));
		for (const a of ['View', 'Create', 'Edit', 'Delete', 'Approve']) expect(within(matrix).getByRole('checkbox', { name: `Time entries: ${a}` })).toBeChecked();
		await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
		expect(within(matrix).getByRole('checkbox', { name: 'Time entries: Approve' })).not.toBeChecked();
		await userEvent.click(screen.getByRole('button', { name: 'Clear everything' }));
		expect(within(matrix).getByRole('checkbox', { name: 'Employees: View' })).not.toBeChecked();
	});

	test('roles are searchable, and a view-only user cannot change anything', async () => {
		mockFetch(api(roles({ you: { roleKey: 'auditor', canManageRoles: false, canManageUsers: false } })));
		renderWithProviders(<AccessPage />, { user: withPerms(manager, ['access.view'], { roleKey: 'auditor', scopeType: 'own_team' }), route: '/access?tab=roles' });
		expect(await screen.findByText(/view roles but not change them/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument();
		await userEvent.type(screen.getByLabelText('Search roles'), 'zzz');
		expect(screen.getByText(/No role matches/)).toBeInTheDocument();
		await userEvent.clear(screen.getByLabelText('Search roles'));
		await userEvent.type(screen.getByLabelText('Search roles'), 'manag');
		expect(screen.getByRole('button', { name: /^Manager/ })).toBeInTheDocument();
	});

	test('creating a role validates on the server and selects the new role', async () => {
		mockFetch(api(roles(), [[/^POST \/access\/roles/, (l, init) => (JSON.parse(init.body).name === 'Bad' ? { status: 409, body: errBody(409, 'CONFLICT', 'A role with this name already exists') } : { status: 201, body: okBody({ id: '31', key: 'hr_viewer' }) })]]));
		renderWithProviders(<AccessPage />, { user: adminUser, route: '/access?tab=roles' });
		await userEvent.click(await screen.findByRole('button', { name: 'New role' }));
		const dialog = await screen.findByRole('dialog');
		const name = within(dialog).getByLabelText(/Role name/);
		await userEvent.type(name, 'Bad');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }));
		expect(await within(dialog).findByText('A role with this name already exists')).toBeInTheDocument();
		await userEvent.clear(name);
		await userEvent.type(name, 'HR viewer');
		await userEvent.click(within(dialog).getByRole('radio', { name: /Every team/ }));
		await pickOption(within(dialog).getByLabelText(/Start from/), 'manager');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Create role' }));
		await waitFor(() => expect(global.fetch.calls.filter((c) => c.line === 'POST /access/roles')).toHaveLength(2));
		const body = JSON.parse(global.fetch.calls.filter((c) => c.line === 'POST /access/roles')[1].init.body);
		expect(body).toMatchObject({ name: 'HR viewer', scopeType: 'all_teams' });
		expect(body.permissions.sort()).toEqual(['employees.edit', 'employees.view', 'time_entries.view']); // copied from the Manager (the creator holds all of them)
	});

	test('users: search, see each role, change access in two steps; you cannot edit yourself', async () => {
		mockFetch(api(roles(), [[/^PATCH \/access\/users\/2/, okBody({ id: '2' })]]));
		renderWithProviders(<AccessPage />, { user: { ...adminUser, userId: '1' }, route: '/access?tab=users' });
		const table = await screen.findByRole('table', { name: 'Users and their roles' });
		expect(within(table).getByText('Maya Rao')).toBeInTheDocument();
		expect(within(table).getByText('You')).toBeInTheDocument(); // Ari Admin: own row has no edit button
		expect(within(table).getByText('Delivery')).toBeInTheDocument(); // team name, not an id
		await userEvent.click(within(table).getByRole('button', { name: 'Edit access for Maya Rao' }));
		const dialog = await screen.findByRole('dialog');
		await pickOption(within(dialog).getByLabelText('Role'), 'admin');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
		expect(dialog).toHaveTextContent('Role: Manager → Administrator');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
		await waitFor(() => expect(global.fetch.calls.some((c) => c.line === 'PATCH /access/users/2')).toBe(true));
		expect(JSON.parse(global.fetch.calls.find((c) => c.line === 'PATCH /access/users/2').init.body)).toEqual({ roleId: '11' });
		expect(await screen.findByText('Access updated for Maya Rao')).toBeInTheDocument();
	});

	test('a refusal from the server (for example privilege escalation) is shown, nothing is hidden', async () => {
		mockFetch(api(roles(), [[/^PATCH \/access\/users\/2/, { status: 403, body: errBody(403, 'ESCALATION_DENIED', 'Only an Administrator can assign the Administrator role') }]]));
		renderWithProviders(<AccessPage />, { user: { ...adminUser, userId: '1' }, route: '/access?tab=users' });
		await userEvent.click(await screen.findByRole('button', { name: 'Edit access for Maya Rao' }));
		const dialog = await screen.findByRole('dialog');
		await userEvent.click(within(dialog).getByRole('switch', { name: /Can sign in/ })); // block this person
		await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
		expect(dialog).toHaveTextContent('Can no longer sign in');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
		expect(await within(dialog).findByText('Only an Administrator can assign the Administrator role')).toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: 'Review' })).toBeInTheDocument(); // back on the form
	});

	test('an API failure while loading offers a retry', async () => {
		mockFetch([[/^GET \/access\/catalog/, okBody(catalog)], [/^GET \/access\/roles/, { status: 503, body: errBody(503, 'DATASTORE_THROTTLED', 'The data service is busy. Retry shortly.') }]]);
		renderWithProviders(<AccessPage />, { user: adminUser });
		expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
	});
});
