import { evaluateFormula } from '../features/spreadsheet/formula';

// A tiny grid: column A = 10, 20, 30; B = 2, "x", 4
const GRID = [
	['10', '2'],
	['20', 'x'],
	['30', '4'],
];
const get = (r, c) => (GRID[r] ? GRID[r][c] : undefined);
const run = (f) => evaluateFormula(f, get, { rows: 3, cols: 2 });
const text = (f) => {
	const r = run(f);
	return r.ok ? r.text : r.code;
};

describe('spreadsheet formulas', () => {
	test('arithmetic follows the usual precedence, with powers, percent and brackets', () => {
		expect(text('=1+2*3')).toBe('7');
		expect(text('=(1+2)*3')).toBe('9');
		expect(text('=2^3^2')).toBe('64'); // left to right, like the sheet's operators
		expect(text('=50%')).toBe('0.5');
		expect(text('=-4+10')).toBe('6');
		expect(text('=0.1+0.2')).toBe('0.3'); // no floating-point noise
	});

	test('cell references and ranges read the grid', () => {
		expect(text('=A1+A2')).toBe('30');
		expect(text('=SUM(A1:A3)')).toBe('60');
		expect(text('=AVERAGE(A1:A3)')).toBe('20');
		expect(text('=MAX(A1:B3)')).toBe('30');
		expect(text('=MIN(A1:B3)')).toBe('2');
		expect(text('=COUNT(B1:B3)')).toBe('2'); // the text cell is not a number
		expect(text('=COUNTA(B1:B3)')).toBe('3');
		expect(text('=MEDIAN(A1:A3)')).toBe('20');
		expect(text('=SUM(A1:A3)/COUNT(A1:A3)')).toBe('20');
	});

	test('functions for rounding, logic and text', () => {
		expect(text('=ROUND(2.345,2)')).toBe('2.35');
		expect(text('=ABS(-3)')).toBe('3');
		expect(text('=SQRT(81)')).toBe('9');
		expect(text('=IF(A1>5,"big","small")')).toBe('big');
		expect(text('=IF(A1>50,"big","small")')).toBe('small');
		expect(text('=CONCAT("a","b",A1)')).toBe('ab10');
		expect(text('="x"&"y"')).toBe('xy');
		expect(text('=UPPER("abc")&LEN("abcd")')).toBe('ABC4');
	});

	test('errors are named, never silently zero', () => {
		expect(text('=1/0')).toBe('#DIV/0!');
		expect(text('=B2+1')).toBe('#VALUE!'); // "x" is not a number
		expect(text('=Z99')).toBe('#REF!');
		expect(text('=NOPE(1)')).toBe('#NAME?');
		expect(text('=1+')).toBe('#ERROR!');
		expect(text('=(1+2')).toBe('#ERROR!');
		expect(text('=SQRT(-1)')).toBe('#NUM!');
		expect(text('=AVERAGE(B2:B2)')).toBe('#DIV/0!');
		expect(run('=1/0').message).toMatch(/zero/i);
	});
});
