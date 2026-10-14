export const PAGE_SIZE = 25;
export const SEARCH_DEBOUNCE_MS = 350;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULTS_PER_GROUP = 5;

// Presentation sections, in the order they are offered. Keys match the backend contract.
export const REPORT_SECTIONS = [
	{ key: 'executive_summary', label: 'Executive summary', description: 'Headline KPIs and key insights' },
	{ key: 'employee_overview', label: 'Employee overview', description: 'Headcount by employment status' },
	{ key: 'attendance_leave', label: 'Attendance and leave', description: 'Late check-ins and approved leave' },
	{ key: 'project_performance', label: 'Project performance', description: 'Project status, workload and burn' },
	{ key: 'billable_hours', label: 'Billable hours', description: 'Billable vs non-billable trend' },
	{ key: 'product_development', label: 'Product development', description: 'Work items by status and type' },
	{ key: 'ai_usage', label: 'AI usage', description: 'Reported tool usage' },
	{ key: 'key_insights', label: 'Key insights', description: 'Notable findings from the data' },
];
