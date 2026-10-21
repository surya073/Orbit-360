/**
 * Front-end view of the permission model. The BACKEND decides and enforces everything; this only lets the
 * UI hide what a user cannot use. A permission key is `<module>.<action>`, for example `employees.edit`.
 * The signed-in user's keys come from GET /me (`user.permissions`).
 */

/** Which permission module guards each record type (the Data Store resource name used by the API). */
export const RESOURCE_MODULE = {
	employees: 'employees',
	teams: 'teams',
	projects: 'projects',
	project_assignments: 'assignments',
	time_entries: 'time_entries',
	attendance_records: 'attendance',
	leave_records: 'leave',
	performance_records: 'performance',
	ai_usage_records: 'ai_usage',
	product_items: 'product',
};
export const moduleOfResource = (resource) => RESOURCE_MODULE[resource] || null;
export const keyOf = (module, action) => `${module}.${action}`;

const ADMIN_ONLY = new Set(['teams.create', 'teams.edit', 'custom_fields.create', 'custom_fields.edit', 'custom_fields.delete']);

/** What the two original roles could do. Used only when a session carries no permission list (older server, test fixtures). */
export const legacyAllowed = (role, key) => role === 'admin' || (role === 'manager' && !key.startsWith('access.') && !ADMIN_ONLY.has(key));

/** `can(key)` for a user object from /me. Unknown or missing means no. */
export function canForUser(user) {
	if (!user) return () => false;
	if (Array.isArray(user.permissions)) {
		const set = new Set(user.permissions);
		return (key) => set.has(key);
	}
	return (key) => legacyAllowed(user.role, key);
}

export const canForRole = (role) => (key) => legacyAllowed(role, key);

/** Short, friendly names for the actions in the matrix and messages. */
export const ACTION_LABEL = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', export: 'Export', approve: 'Approve', manage_roles: 'Manage roles', manage_users: 'Manage users' };
