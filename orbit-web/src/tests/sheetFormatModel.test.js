import { cellStyle, formatNumberText, mergeEdges, sanitizeCell, shownDecimals } from '../features/spreadsheet/sheetFormat';

describe('sheet number formats', () => {
	test('currency, percent, number and auto formats', () => {
		expect(formatNumberText('1000.5', { t: 'currency' })).toBe('£1,000.50');
		expect(formatNumberText('0.1012', { t: 'percent' })).toBe('10.12%');
		expect(formatNumberText('1234567', { t: 'number', d: 0 })).toBe('1,234,567');
		expect(formatNumberText('3', { t: 'auto', d: 2 })).toBe('3.00');
	});

	test('text format and non-numbers are left exactly as they are', () => {
		expect(formatNumberText('12.5', { t: 'text' })).toBe('12.5');
		expect(formatNumberText('Asha Rao', { t: 'currency' })).toBe('Asha Rao');
		expect(formatNumberText('2025-01-02', { t: 'percent' })).toBe('2025-01-02');
	});

	test('decimal places shown follow the format', () => {
		expect(shownDecimals('5', null)).toBe(0);
		expect(shownDecimals('5.25', null)).toBe(2);
		expect(shownDecimals('1000.5', { t: 'currency' })).toBe(2);
	});
});

describe('sheet format sanitising', () => {
	test('keeps well-typed new properties and drops the rest', () => {
		expect(sanitizeCell({ s: true, valign: 'top', font: 'georgia', size: 15, nf: { t: 'percent', d: 1 }, bd: 'tbtb', note: '  hi  ' })).toEqual({ s: true, valign: 'top', font: 'georgia', size: 15, nf: { t: 'percent', d: 1 }, bd: 'tb', note: 'hi' });
		expect(sanitizeCell({ font: 'comic', valign: 'middle-ish', nf: { t: 'bogus' }, bd: 'x', size: 500, note: '   ' })).toBeNull();
	});

	test('clip only applies when the cell is not wrapped', () => {
		expect(sanitizeCell({ wrap: true, clip: true })).toEqual({ wrap: true });
		expect(sanitizeCell({ clip: true })).toEqual({ clip: true });
	});

	test('borders merge edge letters and render as styles', () => {
		expect(mergeEdges('t', 'rb')).toBe('tbr');
		const s = cellStyle({ bd: 'tr', s: true, valign: 'top' });
		expect(s.borderTop).toBeTruthy();
		expect(s.borderRight).toBeTruthy();
		expect(s.borderBottom).toBeUndefined();
		expect(s.textDecoration).toBe('line-through');
		expect(s.alignItems).toBe('flex-start');
	});
});
