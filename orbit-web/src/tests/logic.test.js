import { computeInsights } from '../utils/insights';
import { daysSince, presetLabel, resolvePeriod, trendRange } from '../utils/periods';
import { toneFor } from '../utils/status';
import { visibleNav, flatDestinations } from '../config/navigation';
import { canForRole } from '../config/permissions';
import { overviewFixture, projectsFixture, productFixture, freshnessFixture } from './helpers';

describe('reporting periods (Asia/Kolkata business dates)', () => {
	test('presets resolve to inclusive date ranges', () => {
		const today = '2026-10-13';
		expect(resolvePeriod({ preset: 'this_month' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
		expect(resolvePeriod({ preset: 'last_month' }, today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
		expect(resolvePeriod({ preset: 'last_30_days' }, today)).toEqual({ from: '2026-09-14', to: '2026-10-13' });
		expect(resolvePeriod({ preset: 'this_quarter' }, today)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
		expect(resolvePeriod({ preset: 'custom', from: '2026-01-05', to: '2026-02-01' }, today)).toEqual({ from: '2026-01-05', to: '2026-02-01' });
		expect(resolvePeriod({ preset: 'bogus' }, today).from).toBe('2026-10-01');
	});
	test('year boundaries and leap years', () => {
		expect(resolvePeriod({ preset: 'last_month' }, '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
		expect(resolvePeriod({ preset: 'this_month' }, '2028-02-10').to).toBe('2028-02-29');
		expect(resolvePeriod({ preset: 'this_quarter' }, '2026-02-10')).toEqual({ from: '2026-01-01', to: '2026-03-31' });
	});
	test('trends are clamped to the API limit of 90 days', () => {
		expect(trendRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31', clamped: false });
		const r = trendRange({ from: '2026-01-01', to: '2026-12-31' });
		expect(r.clamped).toBe(true);
		expect(daysSince(r.from, r.to) + 1).toBe(90);
	});
	test('labels', () => expect(presetLabel('last_month')).toBe('Last month'));
});

describe('insights', () => {
	const today = '2026-10-13';
	test('derives plain statements only from returned metrics', () => {
		const out = computeInsights({ overview: overviewFixture, projects: projectsFixture, product: productFixture, freshness: freshnessFixture, today });
		const ids = out.map((i) => i.id);
		expect(ids).toEqual(expect.arrayContaining(['billable-share', 'pending-approval', 'late-rate', 'late-unknown', 'over-1', 'no-estimate', 'overdue']));
		expect(out.find((i) => i.id === 'pending-approval').title).toMatch(/^2 time entries are awaiting approval/);
		expect(out.find((i) => i.id === 'over-1').title).toMatch(/Alpha has used 120\.0% of its estimated hours/);
		expect(ids).not.toContain('stale-time'); // latest entry is 1 day old
	});
	test('says nothing about data that did not load or is empty', () => {
		expect(computeInsights({}).map((i) => i.id)).toEqual(['none']);
		const empty = { ...overviewFixture, time: { completeness: 'insufficient_data', billableMinutes: null, totalMinutes: null, excluded: { pending: 0, rejected: 0 } }, attendance: { completeness: 'insufficient_data', lateRatePercent: null, unknownCount: 0 } };
		expect(computeInsights({ overview: empty }).map((i) => i.id)).toEqual(['none']);
	});
	test('freshness: stale and missing data are called out', () => {
		expect(computeInsights({ freshness: { timeEntries: { latestDate: '2026-09-20' } }, today }).map((i) => i.id)).toContain('stale-time');
		expect(computeInsights({ freshness: { timeEntries: { latestDate: null } }, today }).map((i) => i.id)).toContain('no-time');
	});
	test('a metric marked not_applicable produces no insight from it', () => {
		const o = { ...overviewFixture, attendance: { completeness: 'not_applicable', reason: 'x' }, leave: { completeness: 'not_applicable' } };
		expect(computeInsights({ overview: o, today }).map((i) => i.id)).not.toContain('late-rate');
	});
});

describe('status tones and navigation', () => {
	test('statuses map to tones; unknown values stay neutral', () => {
		expect(toneFor('approved')).toBe('success');
		expect(toneFor('PENDING')).toBe('warning');
		expect(toneFor('rejected')).toBe('danger');
		expect(toneFor('something_new')).toBe('neutral');
		expect(toneFor(null)).toBe('neutral');
	});
	test('navigation exposes every module for both roles, grouped for the compact header', () => {
		const labels = (role) => flatDestinations(canForRole(role)).map((d) => d.label);
		for (const role of ['admin', 'manager']) {
			expect(labels(role)).toEqual(expect.arrayContaining(['Dashboard', 'Employees', 'Teams', 'Projects', 'Time entries', 'Attendance', 'Leave', 'Performance', 'Product development', 'AI & GitHub usage', 'Imports', 'Presentations']));
		}
		expect(visibleNav(canForRole('manager')).filter((n) => n.type === 'group' && n.label !== 'Settings').map((n) => n.label)).toEqual(['People', 'Delivery']);
		expect(labels('manager')).not.toContain('User management'); // only people who may view access settings see it
		expect(labels('admin')).toContain('User management');
		expect(visibleNav(canForRole('stranger')).map((n) => n.label)).toEqual(['Settings']); // preferences are for everyone
	});
});
