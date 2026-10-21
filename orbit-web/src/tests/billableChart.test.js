import { CHART_TYPES, METRICS, chartRows, hasAnyValue, metricById, typeFor } from '../features/dashboard/billableChart';

const trends = {
	filters: { granularity: 'week' },
	time: [
		{ start: '2026-10-05', billableMinutes: 600, nonBillableMinutes: 120, billablePercent: 83.3 },
		{ start: '2026-10-12', billableMinutes: null, nonBillableMinutes: 60, billablePercent: null },
	],
	attendance: [{ start: '2026-10-05', late: 3 }],
};

describe('dashboard chart choices', () => {
	test('every metric offers types the chart can draw, and bars are available for billable hours', () => {
		for (const m of METRICS) {
			expect(m.types.length).toBeGreaterThan(0);
			m.types.forEach((t) => expect(CHART_TYPES[t]).toBeTruthy());
		}
		expect(metricById('billable').types).toContain('bar');
		expect(metricById('split').types).toContain('stacked');
		expect(metricById('nope').id).toBe('billable'); // unknown stored choice falls back
	});

	test('a stored type that does not suit the metric falls back to the metric’s first type', () => {
		expect(typeFor(metricById('billable'), 'bar')).toBe('bar');
		expect(typeFor(metricById('billable'), 'stacked')).toBe('area');
		expect(typeFor(metricById('late'), 'area')).toBe('area');
		expect(typeFor(metricById('split'), undefined)).toBe('bar');
	});

	test('rows come from the loaded trends; missing figures are null, never zero', () => {
		const rows = chartRows(metricById('split'), trends);
		expect(rows).toHaveLength(2);
		expect(rows[0].values).toMatchObject({ billable: 10, nonBillable: 2, total: 12, share: 83.3, late: 3 });
		expect(rows[1].values.billable).toBeNull();
		expect(rows[1].values.total).toBeNull(); // one half missing: no invented total
		expect(rows[1].values.late).toBeNull();
		expect(rows[0].tip).toMatch(/^Week of/);
		expect(chartRows(metricById('billable'), null)).toEqual([]);
	});

	test('a view with no real value is reported as empty', () => {
		expect(hasAnyValue(chartRows(metricById('late'), { ...trends, attendance: [] }), metricById('late'))).toBe(false);
		expect(hasAnyValue(chartRows(metricById('billable'), trends), metricById('billable'))).toBe(true);
	});
});
