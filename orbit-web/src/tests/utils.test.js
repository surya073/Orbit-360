import { csvToRecords, parseCsv, toCsv } from '../utils/csv';
import { businessToday, formatDate, formatDateTime, monthRange } from '../utils/dates';
import { EMPTY, formatMinutes, formatPercent, metricNote } from '../utils/format';
import { buildPayload } from '../components/forms/ResourceForm';

test('missing values render as a dash, never zero', () => {
	expect(formatMinutes(null)).toBe(EMPTY);
	expect(formatMinutes(undefined)).toBe(EMPTY);
	expect(formatMinutes(0)).toBe('0h 00m');
	expect(formatMinutes(150)).toBe('2h 30m');
	expect(formatPercent(null)).toBe(EMPTY);
	expect(formatPercent(12.34)).toBe('12.3%');
	expect(formatDate(null)).toBe(EMPTY);
});

test('date-only values are formatted without timezone shifting', () => {
	expect(formatDate('2026-10-01')).toBe('01 Oct 2026');
	expect(formatDateTime('2026-10-01 09:05:00')).toBe('01 Oct 2026, 09:05');
	expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
});

test('business date follows Asia/Kolkata', () => {
	expect(businessToday(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-14');
});

test('metric notes explain incomplete and empty metrics', () => {
	expect(metricNote({ completeness: 'insufficient_data' })).toMatch(/no data/i);
	expect(metricNote({ completeness: 'partial', missing: 'pending_approval' })).toMatch(/pending approval/);
	expect(metricNote({ completeness: 'not_applicable', reason: 'Not available when filtering by project' })).toMatch(/project/);
	expect(metricNote({ completeness: 'complete' })).toBeNull();
});

test('csv parser handles quotes, commas, CRLF and BOM', () => {
	const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
	expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
	expect(() => parseCsv('a\n"open')).toThrow(/unterminated/);
	expect(parseCsv(toCsv(rows))).toEqual(rows);
});

test('csv import maps headers to fields and omits blanks instead of defaulting', () => {
	const { records, unmapped } = csvToRecords('Employee ID,Duration Minutes,Notes\n5,,hello\n', ['employee_id', 'duration_minutes']);
	expect(records).toEqual([{ employee_id: '5' }]);
	expect(unmapped).toEqual(['Notes']);
	expect(() => csvToRecords('a,b', ['a'])).toThrow();
});

test('form payload omits blanks, skips immutable on edit, and sends only changes', () => {
	const cols = [{ field: 'employee_id', type: 'id' }, { field: 'duration_minutes', type: 'int' }, { field: 'work_description', type: 'text' }];
	expect(buildPayload(cols, { employee_id: '1', duration_minutes: '0', work_description: '' }, null, [])).toEqual({ employee_id: '1', duration_minutes: '0' });
	const initial = { employee_id: '1', duration_minutes: 30, work_description: 'x' };
	expect(buildPayload(cols, { employee_id: '2', duration_minutes: '45', work_description: 'x' }, initial, ['employee_id'])).toEqual({ duration_minutes: '45' });
});
