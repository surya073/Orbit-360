/**
 * Spreadsheet formulas, evaluated when a cell is committed (type `=SUM(D2:D9)*1.18` like in Google Sheets).
 * Pure: no React, no network. The result replaces the typed text, because every cell is one field of one record
 * and the record API stores values, not formulas.
 *
 * Supported: numbers, "text", cell references (A1) and ranges (A1:B5); + - * / ^ & % and comparisons
 * (= <> < > <= >=); SUM AVERAGE (AVG) COUNT COUNTA MAX MIN MEDIAN PRODUCT ROUND ABS SQRT IF CONCAT
 * (CONCATENATE) LEN UPPER LOWER TRIM.
 */

const FN_ARITY = { ROUND: [1, 2], ABS: [1, 1], SQRT: [1, 1], IF: [2, 3], LEN: [1, 1], UPPER: [1, 1], LOWER: [1, 1], TRIM: [1, 1] };

class FormulaError extends Error {
	constructor(code, message) {
		super(message || code);
		this.code = code;
	}
}

/** "AB" -> 27 (1-based column number) */
const colNumber = (letters) => letters.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

function tokenize(src) {
	const out = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (/\s/.test(ch)) {
			i++;
		} else if (/[0-9.]/.test(ch)) {
			const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
			if (!m) throw new FormulaError('#ERROR!', 'Unexpected character');
			out.push({ t: 'num', v: Number(m[0]) });
			i += m[0].length;
		} else if (ch === '"') {
			let j = i + 1;
			let s = '';
			while (j < src.length && src[j] !== '"') s += src[j++];
			if (j >= src.length) throw new FormulaError('#ERROR!', 'Unclosed text: add a closing "');
			out.push({ t: 'str', v: s });
			i = j + 1;
		} else if (/[A-Za-z_]/.test(ch)) {
			const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
			out.push({ t: 'id', v: m[0].toUpperCase() });
			i += m[0].length;
		} else if (/[<>=]/.test(ch)) {
			const two = src.slice(i, i + 2);
			if (['<=', '>=', '<>'].includes(two)) {
				out.push({ t: 'op', v: two });
				i += 2;
			} else {
				out.push({ t: 'op', v: ch });
				i++;
			}
		} else if ('+-*/^&%(),:'.includes(ch)) {
			out.push({ t: 'op', v: ch });
			i++;
		} else {
			throw new FormulaError('#ERROR!', `Unexpected "${ch}"`);
		}
	}
	return out;
}

const toNumber = (v) => {
	if (typeof v === 'number') return v;
	if (typeof v === 'boolean') return v ? 1 : 0;
	if (v === null || v === undefined || v === '') return 0;
	const n = Number(String(v).replace(/,/g, '').trim());
	if (Number.isNaN(n)) throw new FormulaError('#VALUE!', `"${v}" is not a number`);
	return n;
};
const isNumeric = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(/,/g, '').trim())));
const flatten = (args) => args.flatMap((a) => (Array.isArray(a) ? a : [a]));
const numbersOf = (args) => flatten(args).filter((v) => isNumeric(v)).map((v) => toNumber(v));

const FUNCTIONS = {
	SUM: (a) => numbersOf(a).reduce((x, y) => x + y, 0),
	PRODUCT: (a) => numbersOf(a).reduce((x, y) => x * y, 1),
	AVERAGE: (a) => {
		const n = numbersOf(a);
		if (!n.length) throw new FormulaError('#DIV/0!', 'No numbers to average');
		return n.reduce((x, y) => x + y, 0) / n.length;
	},
	COUNT: (a) => numbersOf(a).length,
	COUNTA: (a) => flatten(a).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length,
	MAX: (a) => {
		const n = numbersOf(a);
		return n.length ? Math.max(...n) : 0;
	},
	MIN: (a) => {
		const n = numbersOf(a);
		return n.length ? Math.min(...n) : 0;
	},
	MEDIAN: (a) => {
		const n = numbersOf(a).sort((x, y) => x - y);
		if (!n.length) throw new FormulaError('#NUM!', 'No numbers');
		const mid = Math.floor(n.length / 2);
		return n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
	},
	ROUND: (a) => {
		const d = a.length > 1 ? toNumber(a[1]) : 0;
		const f = 10 ** d;
		return Math.round((toNumber(a[0]) + Number.EPSILON) * f) / f;
	},
	ABS: (a) => Math.abs(toNumber(a[0])),
	SQRT: (a) => {
		const n = toNumber(a[0]);
		if (n < 0) throw new FormulaError('#NUM!', 'Square root of a negative number');
		return Math.sqrt(n);
	},
	IF: (a) => (a[0] && a[0] !== '0' && a[0] !== 0 ? a[1] : a.length > 2 ? a[2] : false),
	CONCAT: (a) => flatten(a).map((v) => (v === null || v === undefined ? '' : String(v))).join(''),
	LEN: (a) => String(a[0] ?? '').length,
	UPPER: (a) => String(a[0] ?? '').toUpperCase(),
	LOWER: (a) => String(a[0] ?? '').toLowerCase(),
	TRIM: (a) => String(a[0] ?? '').trim().replace(/\s+/g, ' '),
};
FUNCTIONS.AVG = FUNCTIONS.AVERAGE;
FUNCTIONS.CONCATENATE = FUNCTIONS.CONCAT;

/**
 * evaluateFormula('=SUM(A1:A3)*2', getCell) -> { ok: true, value, text } | { ok: false, code, message }
 * `getCell(row, col)` takes 0-based indexes and returns the cell's value (string, number or empty);
 * `size` ({ rows, cols }) bounds what a reference may point at.
 */
export function evaluateFormula(src, getCell, size = { rows: Infinity, cols: Infinity }) {
	try {
		const text = String(src).trim();
		if (!text.startsWith('=')) throw new FormulaError('#ERROR!', 'A formula starts with =');
		const toks = tokenize(text.slice(1));
		if (!toks.length) throw new FormulaError('#ERROR!', 'Nothing after =');
		let p = 0;
		const peek = () => toks[p];
		const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
		const take = () => toks[p++];
		const expectOp = (v) => {
			if (!isOp(v)) throw new FormulaError('#ERROR!', `Expected "${v}"`);
			p++;
		};

		const refValue = (id) => {
			const m = /^([A-Z]{1,3})(\d+)$/.exec(id);
			if (!m) return null;
			const c = colNumber(m[1]) - 1;
			const r = Number(m[2]) - 1;
			if (r < 0 || r >= size.rows || c >= size.cols) throw new FormulaError('#REF!', `${id} is outside the sheet`);
			return { r, c };
		};
		const cell = (r, c) => {
			const v = getCell(r, c);
			return v === undefined || v === null ? '' : v;
		};

		const parseAtom = () => {
			const t = take();
			if (!t) throw new FormulaError('#ERROR!', 'The formula ends too soon');
			if (t.t === 'num') return t.v;
			if (t.t === 'str') return t.v;
			if (t.t === 'op' && t.v === '(') {
				const v = parseCompare();
				expectOp(')');
				return v;
			}
			if (t.t === 'op' && t.v === '-') return -toNumber(parseUnary());
			if (t.t === 'op' && t.v === '+') return toNumber(parseUnary());
			if (t.t === 'id') {
				if (isOp('(')) {
					take();
					const args = [];
					if (!isOp(')')) {
						args.push(parseCompare());
						while (isOp(',')) {
							take();
							args.push(parseCompare());
						}
					}
					expectOp(')');
					const fn = FUNCTIONS[t.v];
					if (!fn) throw new FormulaError('#NAME?', `Unknown function ${t.v}`);
					const [min, max] = FN_ARITY[t.v] || [0, Infinity];
					if (args.length < min || args.length > max) throw new FormulaError('#ERROR!', `${t.v} takes ${min === max ? min : `${min} to ${max === Infinity ? 'many' : max}`} value(s)`);
					return fn(args);
				}
				if (t.v === 'TRUE') return true;
				if (t.v === 'FALSE') return false;
				const a = refValue(t.v);
				if (!a) throw new FormulaError('#NAME?', `Unknown name ${t.v}`);
				if (isOp(':')) {
					take();
					const e = take();
					const b = e && e.t === 'id' ? refValue(e.v) : null;
					if (!b) throw new FormulaError('#REF!', 'A range needs two cells, like A1:B5');
					const vals = [];
					for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) vals.push(cell(r, c));
					return vals;
				}
				const v = cell(a.r, a.c);
				return isNumeric(v) ? toNumber(v) : v;
			}
			throw new FormulaError('#ERROR!', `Unexpected "${t.v}"`);
		};
		const parsePercent = () => {
			let v = parseAtom();
			while (isOp('%')) {
				take();
				v = toNumber(v) / 100;
			}
			return v;
		};
		function parseUnary() {
			return parsePercent();
		}
		const parsePow = () => {
			let v = parseUnary();
			while (isOp('^')) {
				take();
				v = toNumber(v) ** toNumber(parseUnary());
			}
			return v;
		};
		const parseMul = () => {
			let v = parsePow();
			while (isOp('*') || isOp('/')) {
				const op = take().v;
				const r = toNumber(parsePow());
				if (op === '/' && r === 0) throw new FormulaError('#DIV/0!', 'Division by zero');
				v = op === '*' ? toNumber(v) * r : toNumber(v) / r;
			}
			return v;
		};
		const parseAdd = () => {
			let v = parseMul();
			while (isOp('+') || isOp('-')) {
				const op = take().v;
				const r = toNumber(parseMul());
				v = op === '+' ? toNumber(v) + r : toNumber(v) - r;
			}
			return v;
		};
		const parseConcat = () => {
			let v = parseAdd();
			while (isOp('&')) {
				take();
				v = `${v ?? ''}${parseAdd() ?? ''}`;
			}
			return v;
		};
		function parseCompare() {
			let v = parseConcat();
			while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
				const op = take().v;
				const r = parseConcat();
				const num = isNumeric(v) && isNumeric(r);
				const a = num ? toNumber(v) : String(v).toLowerCase();
				const b = num ? toNumber(r) : String(r).toLowerCase();
				v = { '=': a === b, '<>': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[op];
			}
			return v;
		}

		let value = parseCompare();
		if (p < toks.length) throw new FormulaError('#ERROR!', `Unexpected "${toks[p].v}"`);
		if (Array.isArray(value)) value = value.length === 1 ? value[0] : FUNCTIONS.SUM([value]);
		if (typeof value === 'number') {
			if (!Number.isFinite(value)) throw new FormulaError('#NUM!', 'The result is not a number');
			value = Number(value.toPrecision(12));
		}
		const textOut = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
		return { ok: true, value, text: textOut };
	} catch (e) {
		if (e instanceof FormulaError) return { ok: false, code: e.code, message: e.message };
		return { ok: false, code: '#ERROR!', message: 'Could not read that formula' };
	}
}
