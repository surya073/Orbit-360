// Dashboard widgets the user may reorder or hide. The default order matches the original layout.
// The layout is a per-device cosmetic preference (like theme) kept in localStorage; it never
// changes which data a user may see: every widget still loads its own backend-scoped data.
export const DASHBOARD_WIDGETS = [
	{ id: 'kpis', label: 'Key metrics', description: 'Headline employee, project, time and attendance figures' },
	{ id: 'billable-trend', label: 'Billable hours trend', description: 'Billable versus non-billable time over the period' },
	{ id: 'attendance-trend', label: 'Attendance trend', description: 'Late check-in rate over the period' },
	{ id: 'project-health', label: 'Project health', description: 'Project status mix and delivery health' },
	{ id: 'product-status', label: 'Product status', description: 'Product backlog by status' },
	{ id: 'ai-usage', label: 'AI usage', description: 'AI tool adoption and cost' },
	{ id: 'insights', label: 'Insights', description: 'Plain-language observations from the data above' },
];

export const DASHBOARD_LAYOUT_KEY = 'company360.dashboardLayout';
export const DEFAULT_ORDER = DASHBOARD_WIDGETS.map((w) => w.id);

/**
 * Turn whatever was stored into a valid layout: unknown ids are dropped, widgets added in a later
 * release are appended (visible), duplicates collapse. Bad data falls back to the default.
 */
export function normalizeLayout(raw) {
	const known = new Set(DEFAULT_ORDER);
	const order = [];
	const src = raw && Array.isArray(raw.order) ? raw.order : [];
	for (const id of src) if (known.has(id) && !order.includes(id)) order.push(id);
	for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
	const hidden = (raw && Array.isArray(raw.hidden) ? raw.hidden : []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
	return { order, hidden };
}
