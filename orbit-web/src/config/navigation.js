import { ROUTES } from './routes';

/**
 * Top navigation. A `group` renders as a dropdown (and as a labelled section on mobile).
 * Each destination names the permission that shows it (`permission`); this drives UX only,
 * the backend authorizes every request.
 */
export const NAV = [
	{ type: 'link', to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard', end: true, permission: 'dashboard.view' },
	{
		type: 'group',
		label: 'People',
		icon: 'users',
		items: [
			{ to: ROUTES.employees, label: 'Employees', description: 'Directory and employment status', icon: 'users', permission: 'employees.view' },
			{ to: ROUTES.teams, label: 'Teams', description: 'Team structure', icon: 'team', permission: 'teams.view' },
			{ to: ROUTES.attendance, label: 'Attendance', description: 'Check-ins and late arrivals', icon: 'clock', permission: 'attendance.view' },
			{ to: ROUTES.leave, label: 'Leave', description: 'Requests and approvals', icon: 'calendar', permission: 'leave.view' },
			{ to: ROUTES.performance, label: 'Performance', description: 'Review records', icon: 'trend', permission: 'performance.view' },
		],
	},
	{
		type: 'group',
		label: 'Delivery',
		icon: 'folder',
		items: [
			{ to: ROUTES.projects, label: 'Projects', description: 'Projects and assignments', icon: 'folder', permission: 'projects.view' },
			{ to: ROUTES.time, label: 'Time entries', description: 'Billable and non-billable hours', icon: 'clock', permission: 'time_entries.view' },
			{ to: ROUTES.product, label: 'Product development', description: 'Tasks, features, bugs, releases', icon: 'box', permission: 'product.view' },
			{ to: ROUTES.usage, label: 'AI & GitHub usage', description: 'Tool usage as reported', icon: 'sparkles', permission: 'ai_usage.view' },
		],
	},
	// The spreadsheet editor is one of the data-entry modes inside Imports, so Imports stays marked while it is open.
	{ type: 'link', to: ROUTES.imports, label: 'Imports', icon: 'upload', permission: 'imports.view', alsoActive: [ROUTES.spreadsheet] },
	{ type: 'link', to: ROUTES.presentations, label: 'Presentations', icon: 'present', permission: 'presentations.view' },
	{ type: 'link', to: ROUTES.access, label: 'Access', icon: 'lock', permission: 'access.view' },
];

/** The navigation this user may see. `can` is `(permissionKey) => boolean` (see useAuth). A group with nothing visible disappears. */
export const visibleNav = (can) =>
	NAV.map((n) => (n.type === 'group' ? { ...n, items: n.items.filter((i) => can(i.permission)) } : n)).filter((n) => (n.type === 'group' ? n.items.length > 0 : can(n.permission)));

/** Flat list of every destination, used by mobile navigation and the search palette's page shortcuts. */
export const flatDestinations = (can) =>
	visibleNav(can).flatMap((n) => (n.type === 'group' ? n.items.map((i) => ({ ...i, group: n.label })) : [{ to: n.to, label: n.label, icon: n.icon, end: n.end }]));

/** Is a top-level link the current page, counting pages that live inside it (the spreadsheet inside Imports)? */
export const isLinkActive = (item, pathname) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)) || (item.alsoActive || []).some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Is `pathname` one of this group's pages (or below one, like /employees/reporting)? */
export const isGroupActive = (group, pathname) => group.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

/** The visible group the current page belongs to, or undefined on a page that is not inside a group. */
export const activeGroup = (can, pathname) => visibleNav(can).find((n) => n.type === 'group' && isGroupActive(n, pathname));

/** The first page this user may open (where "home" goes when the Dashboard is not allowed). */
export const firstDestination = (can) => {
	const all = flatDestinations(can);
	return all.length ? all[0].to : null;
};
