import { ROLES, ROUTES } from './routes';

const BOTH = [ROLES.ADMIN, ROLES.MANAGER];

/**
 * Top navigation. A `group` renders as a dropdown (and as a labelled section on mobile).
 * Role lists drive UX only; the backend authorizes every request.
 */
export const NAV = [
	{ type: 'link', to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard', end: true, roles: BOTH },
	{
		type: 'group',
		label: 'People',
		icon: 'users',
		roles: BOTH,
		items: [
			{ to: ROUTES.employees, label: 'Employees', description: 'Directory and employment status', icon: 'users' },
			{ to: ROUTES.teams, label: 'Teams', description: 'Team structure', icon: 'team' },
			{ to: ROUTES.attendance, label: 'Attendance', description: 'Check-ins and late arrivals', icon: 'clock' },
			{ to: ROUTES.leave, label: 'Leave', description: 'Requests and approvals', icon: 'calendar' },
			{ to: ROUTES.performance, label: 'Performance', description: 'Review records', icon: 'trend' },
		],
	},
	{
		type: 'group',
		label: 'Delivery',
		icon: 'folder',
		roles: BOTH,
		items: [
			{ to: ROUTES.projects, label: 'Projects', description: 'Projects and assignments', icon: 'folder' },
			{ to: ROUTES.time, label: 'Time entries', description: 'Billable and non-billable hours', icon: 'clock' },
			{ to: ROUTES.product, label: 'Product development', description: 'Tasks, features, bugs, releases', icon: 'box' },
			{ to: ROUTES.usage, label: 'AI & GitHub usage', description: 'Tool usage as reported', icon: 'sparkles' },
		],
	},
	{ type: 'link', to: ROUTES.imports, label: 'Imports', icon: 'upload', roles: BOTH },
	{ type: 'link', to: ROUTES.presentations, label: 'Presentations', icon: 'present', roles: BOTH },
];

export const visibleNav = (role) =>
	NAV.filter((n) => n.roles.includes(role));

/** Flat list of every destination, used by mobile navigation and the search palette's page shortcuts. */
export const flatDestinations = (role) =>
	visibleNav(role).flatMap((n) => (n.type === 'group' ? n.items.map((i) => ({ ...i, group: n.label })) : [{ to: n.to, label: n.label, icon: n.icon, end: n.end }]));
