import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContextForTests } from './authContext';
import { ThemeProvider } from '../app/providers/ThemeProvider';
import { ToastProvider } from '../components/feedback/ToastProvider';

export const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
export const okBody = (data, meta) => ({ ok: true, data, ...(meta ? { meta } : {}) });
export const errBody = (status, code, message, details) => ({ ok: false, requestId: 'req-12345678', error: { code, message, details } });

/**
 * fetch mock: `routes` is a list of [matcher, responder]. A matcher is a RegExp tested against
 * "METHOD /path?query" (the API base is stripped). A responder returns { status?, body } or a body.
 * Unmatched calls fail loudly so a test never silently depends on an unmocked endpoint.
 */
export function mockFetch(routes) {
	const calls = [];
	global.fetch = jest.fn((url, init = {}) => {
		const path = String(url).replace(/^.*\/api\/v1/, '');
		const line = `${init.method || 'GET'} ${path}`;
		calls.push({ line, init });
		for (const [re, fn] of routes) {
			if (re.test(line)) {
				const out = typeof fn === 'function' ? fn(line, init) : fn;
				const status = out && out.status ? out.status : 200;
				return json(status, out && out.body !== undefined ? out.body : out);
			}
		}
		return Promise.reject(new Error(`Unmocked request: ${line}`));
	});
	global.fetch.calls = calls;
	return global.fetch;
}

export const manager = { userId: '2', displayName: 'Maya Rao', email: 'maya@example.com', role: 'manager', teamId: '7' };
export const admin = { userId: '1', displayName: 'Ari Admin', email: 'ari@example.com', role: 'admin', teamId: null };

/** Renders UI inside the same providers the app uses, with a fixed signed-in user. */
export function renderWithProviders(ui, { user = manager, route = '/' } = {}) {
	return render(
		<ThemeProvider>
			<ToastProvider>
				<MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
					<AuthContextForTests user={user}>{ui}</AuthContextForTests>
				</MemoryRouter>
			</ToastProvider>
		</ThemeProvider>
	);
}

// ---- fixtures: the shapes the backend returns ------------------------------------------------
export const overviewFixture = {
	filters: { from: '2026-10-01', to: '2026-10-31', teamId: '7', projectId: null, employeeId: null, timezone: 'Asia/Kolkata' },
	time: { completeness: 'partial', missing: 'pending_approval', billableMinutes: 600, nonBillableMinutes: 300, totalMinutes: 900, billablePercent: 66.7, approvedEntries: 9, excluded: { pending: 2, rejected: 1 } },
	attendance: { completeness: 'partial', missing: 'late_status_unknown', lateCount: 2, onTimeCount: 6, unknownCount: 1, lateRatePercent: 25, records: 9 },
	leave: { completeness: 'complete', approvedDays: 3, approvedHours: 0, byStatus: { approved: 2 }, records: 2 },
	headcount: { completeness: 'complete', total: 12, byStatus: { active: 11, on_leave: 1 } },
};
export const trendsFixture = {
	filters: { granularity: 'week' },
	truncated: false,
	time: [
		{ start: '2026-10-05', completeness: 'complete', billableMinutes: 300, nonBillableMinutes: 60, billablePercent: 83.3, approvedEntries: 4, pendingEntries: 0 },
		{ start: '2026-10-12', completeness: 'partial', billableMinutes: 300, nonBillableMinutes: 240, billablePercent: 55.6, approvedEntries: 5, pendingEntries: 2 },
	],
	attendance: [{ start: '2026-10-05', completeness: 'complete', lateCount: 1, onTimeCount: 3, unknownCount: 0, lateRatePercent: 25 }],
};
export const projectsFixture = {
	filters: {},
	status: { completeness: 'complete', total: 5, byStatus: { active: 3, on_hold: 2 } },
	workload: { completeness: 'partial', missing: 'estimate_not_recorded', projectsWithTime: 2, truncated: false, projects: [{ projectId: '1', name: 'Alpha', status: 'active', periodMinutes: 300, entries: 3, estimatedHours: 10, lifetimeMinutes: 720, burnPercent: 120 }, { projectId: '2', name: 'Beta', status: 'active', periodMinutes: 120, entries: 1, estimatedHours: null, lifetimeMinutes: 120, burnPercent: null }] },
};
export const productFixture = { asOf: '2026-10-13', product: { completeness: 'complete', total: 7, byStatus: { open: 4, done: 3 }, byType: { bug: { open: 2, done: 1 }, task: { open: 2, done: 2 } }, overdue: 2 } };
export const aiFixture = { usage: { completeness: 'partial', missing: 'reporting_period_not_recorded', totalRecords: 4, toolCount: 2, byCategory: { github: 3, ai: 1 }, tools: [{ tool: 'Copilot', category: 'github', records: 3, avgReportedPercent: 50 }, { tool: 'ChatGPT', category: 'ai', records: 1, avgReportedPercent: null }], missingPeriod: 1, truncated: false } };
export const freshnessFixture = { asOf: '2026-10-13 10:00:00', timeEntries: { latestDate: '2026-10-12' }, attendance: { latestDate: '2026-10-12' }, imports: { lastCompletedAt: '2026-10-10 09:00:00' } };

/** Routes for every dashboard endpoint (override entries by prepending your own to mockFetch). */
/** The one-request dashboard answer. `over` replaces a section's data, or fails it with `{ error: { status, code, message } }`. */
export const bundleOf = (over = {}) => {
	const base = { overview: overviewFixture, trends: trendsFixture, projects: projectsFixture, product: productFixture, ai: aiFixture, freshness: freshnessFixture };
	return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, over[k] && over[k].error ? { ok: false, error: over[k].error } : { ok: true, data: over[k] || v }]));
};

export const dashboardRoutes = (over = {}) => [
	[/^GET \/dashboard\/bundle/, () => okBody(bundleOf(over))],
	[/^GET \/dashboard\/overview/, okBody(overviewFixture)],
	[/^GET \/dashboard\/trends/, okBody(trendsFixture)],
	[/^GET \/dashboard\/projects/, okBody(projectsFixture)],
	[/^GET \/dashboard\/product/, okBody(productFixture)],
	[/^GET \/dashboard\/ai-usage/, okBody(aiFixture)],
	[/^GET \/dashboard\/freshness/, okBody(freshnessFixture)],
	[/^GET \/teams/, okBody([{ ROWID: '7', name: 'Delivery', team_code: 'DEL' }], { page: 1, pageSize: 100, total: 1, totalPages: 1 })],
];
