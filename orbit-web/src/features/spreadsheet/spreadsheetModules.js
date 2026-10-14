import { ROUTES } from '../../config/routes';

/**
 * Record types the spreadsheet can edit. The columns themselves come from the backend field
 * contract (GET /imports/templates); this only adds titles, the page that hosts the Add form, and
 * whether the list endpoint supports server-side search. Read-only resources are not listed.
 */
export const SHEET_MODULES = [
	{ resource: 'employees', title: 'Employees', route: ROUTES.employees, search: 'Search employees by name' },
	{ resource: 'teams', title: 'Teams', route: ROUTES.teams, search: 'Search teams by name' },
	{ resource: 'projects', title: 'Projects', route: ROUTES.projects, search: 'Search projects by name' },
	{ resource: 'project_assignments', title: 'Project assignments', route: ROUTES.projects },
	{ resource: 'time_entries', title: 'Time entries', route: ROUTES.time },
	{ resource: 'attendance_records', title: 'Attendance', route: ROUTES.attendance },
	{ resource: 'leave_records', title: 'Leave', route: ROUTES.leave },
	{ resource: 'ai_usage_records', title: 'AI & GitHub usage', route: ROUTES.usage, search: 'Search by tool name' },
	{ resource: 'product_items', title: 'Product development', route: ROUTES.product, search: 'Search by title' },
];

export const sheetModule = (resource) => SHEET_MODULES.find((m) => m.resource === resource);
