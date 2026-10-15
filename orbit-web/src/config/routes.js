export const ROLES = { ADMIN: 'admin', MANAGER: 'manager' };

export const ROUTES = {
	login: '/login',
	dashboard: '/',
	employees: '/employees',
	reporting: '/employees/reporting',
	teams: '/teams',
	projects: '/projects',
	time: '/time-entries',
	attendance: '/attendance',
	leave: '/leave',
	performance: '/performance',
	usage: '/ai-usage',
	product: '/product-development',
	imports: '/imports',
	spreadsheet: '/spreadsheet',
	presentations: '/presentations',
	presentationNew: '/presentations/new',
	presentationEdit: (id = ':id') => `/presentations/${id}/edit`,
	present: (id = ':id') => `/presentations/${id}/present`,
	settings: '/settings',
	access: '/access',
};
