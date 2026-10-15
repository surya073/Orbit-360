'use strict';

/**
 * The permission catalog: the single list of what the application can authorize.
 *
 * A permission key is `<module>.<action>` (for example `employees.edit`). The code enforces keys
 * (routes declare the key they need; services re-check it). Which ROLE holds which key is data
 * (tables `roles` + `role_permissions`), so adding a module means adding one entry here and every
 * role can be granted it from the Access & Permissions screen - no new hardcoded role logic.
 *
 * `managerDefaults` is what the built-in "manager" role holds. It reproduces the application's
 * behaviour from before roles became configurable. The built-in "admin" role always holds every key
 * and cannot be edited.
 */

const ACTIONS = Object.freeze({
	view: { label: 'View', description: 'See the module and its records' },
	create: { label: 'Create', description: 'Add new records' },
	edit: { label: 'Edit', description: 'Change existing records' },
	delete: { label: 'Delete', description: 'Remove records' },
	export: { label: 'Export', description: 'Download or save the data shown' },
	approve: { label: 'Approve', description: 'Approve or reject submitted items' },
	manage_roles: { label: 'Manage roles', description: 'Create roles and change what they can do' },
	manage_users: { label: 'Manage users', description: 'Assign roles and teams, activate or deactivate users' },
});

const CRUD = ['view', 'create', 'edit', 'delete'];

const MODULES = Object.freeze([
	{ key: 'dashboard', label: 'Dashboard', group: 'Overview', description: 'KPIs, trends and saved report snapshots', actions: ['view', 'export'], managerDefaults: ['view', 'export'] },
	{ key: 'employees', label: 'Employees', group: 'People', description: 'Employee directory', actions: CRUD, managerDefaults: CRUD, resource: 'employees' },
	{ key: 'reporting', label: 'Reporting structure', group: 'People', description: 'Who reports to whom', actions: ['view', 'edit'], managerDefaults: ['view', 'edit'] },
	{ key: 'teams', label: 'Teams', group: 'People', description: 'Team structure', actions: ['view', 'create', 'edit'], managerDefaults: ['view'], resource: 'teams' },
	{ key: 'attendance', label: 'Attendance', group: 'People', description: 'Check-ins and late arrivals', actions: CRUD, managerDefaults: CRUD, resource: 'attendance_records' },
	{ key: 'leave', label: 'Leave', group: 'People', description: 'Leave requests and approvals', actions: CRUD, managerDefaults: CRUD, resource: 'leave_records' },
	{ key: 'performance', label: 'Performance', group: 'People', description: 'Performance records and metric definitions', actions: ['view'], managerDefaults: ['view'], resource: 'performance_records' },
	{ key: 'projects', label: 'Projects', group: 'Delivery', description: 'Projects', actions: CRUD, managerDefaults: CRUD, resource: 'projects' },
	{ key: 'assignments', label: 'Project assignments', group: 'Delivery', description: 'Who is assigned to which project', actions: CRUD, managerDefaults: CRUD, resource: 'project_assignments' },
	{ key: 'time_entries', label: 'Time entries', group: 'Delivery', description: 'Billable and non-billable hours', actions: [...CRUD, 'approve'], managerDefaults: [...CRUD, 'approve'], resource: 'time_entries' },
	{ key: 'product', label: 'Product development', group: 'Delivery', description: 'Tasks, features, bugs and releases', actions: CRUD, managerDefaults: CRUD, resource: 'product_items' },
	{ key: 'ai_usage', label: 'AI & GitHub usage', group: 'Delivery', description: 'Reported tool usage', actions: CRUD, managerDefaults: CRUD, resource: 'ai_usage_records' },
	{ key: 'imports', label: 'Imports', group: 'Data', description: 'Bulk import from sheets (each import also needs Create on the target module)', actions: ['view', 'create'], managerDefaults: ['view', 'create'] },
	{ key: 'spreadsheet', label: 'Spreadsheet', group: 'Data', description: 'Spreadsheet editor (record changes also need Edit/Create on the module)', actions: ['view', 'export'], managerDefaults: ['view', 'export'] },
	{ key: 'presentations', label: 'Presentations', group: 'Data', description: 'Saved presentations', actions: CRUD, managerDefaults: CRUD },
	{ key: 'access', label: 'Access & Permissions', group: 'Administration', description: 'Roles, users and permissions', actions: ['view', 'manage_roles', 'manage_users'], managerDefaults: [] },
]);

const KEY = (module, action) => `${module}.${action}`;
const ALL_KEYS = Object.freeze(MODULES.flatMap((m) => m.actions.map((a) => KEY(m.key, a))));
const KEY_SET = new Set(ALL_KEYS);
const MANAGER_DEFAULT_KEYS = Object.freeze(MODULES.flatMap((m) => m.managerDefaults.map((a) => KEY(m.key, a))));

const MODULE_BY_RESOURCE = Object.freeze(Object.fromEntries(MODULES.filter((m) => m.resource).map((m) => [m.resource, m.key])));
// Read-only reference data that follows its parent module's View permission.
const EXTRA_RESOURCE_MODULES = Object.freeze({ metric_definitions: 'performance', report_snapshots: 'dashboard', import_jobs: 'imports', audit_logs: 'access' });

/** Module key that guards a Data Store resource (e.g. attendance_records -> attendance). */
const moduleOfResource = (resource) => MODULE_BY_RESOURCE[resource] || EXTRA_RESOURCE_MODULES[resource] || null;

const isPermissionKey = (key) => KEY_SET.has(key);

/** Roles that ship with the application. `admin` is the protected super-administrator role. */
const SCOPE_TYPES = Object.freeze({ ALL_TEAMS: 'all_teams', OWN_TEAM: 'own_team' });
const DEFAULT_ROLES = Object.freeze({
	admin: Object.freeze({ key: 'admin', name: 'Administrator', description: 'Full access to every module and every team. This role is protected and cannot be edited.', scopeType: SCOPE_TYPES.ALL_TEAMS, isSystem: true, permissions: ALL_KEYS }),
	manager: Object.freeze({ key: 'manager', name: 'Manager', description: 'Works with the data of their assigned team.', scopeType: SCOPE_TYPES.OWN_TEAM, isSystem: true, permissions: MANAGER_DEFAULT_KEYS }),
});
const PROTECTED_ROLE_KEY = 'admin';

/** Public, UI-friendly description of the catalog. */
const catalog = () => ({
	actions: Object.entries(ACTIONS).map(([key, a]) => ({ key, ...a })),
	modules: MODULES.map(({ key, label, group, description, actions }) => ({ key, label, group, description, actions })),
});

module.exports = { ACTIONS, MODULES, ALL_KEYS, MANAGER_DEFAULT_KEYS, DEFAULT_ROLES, SCOPE_TYPES, PROTECTED_ROLE_KEY, KEY, catalog, isPermissionKey, moduleOfResource };
