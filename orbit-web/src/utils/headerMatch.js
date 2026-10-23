/**
 * Smart column matching for imports (what Zoho People does when you upload a file): every header of the file is
 * matched to a template field by name, common aliases, similarity, and what the values look like. Runs in the
 * browser only; nothing about the file is sent anywhere. Each field is claimed at most once.
 *
 * match(headers, cells, columns) -> [{ field, confidence: 'high' | 'medium', score } | null] (one entry per header)
 *   columns = template.columns plus any extra import columns, as [{ field, type, required, values? }].
 */

export const HIGH = 0.85; // matched without asking
export const MEDIUM = 0.62; // pre-filled, but shown for the user to check

// Words that mean the same thing, folded to one token before comparing.
const CANON = {
	emp: 'employee', employee: 'employee', employees: 'employee', staff: 'employee', associate: 'employee', worker: 'employee',
	mail: 'email', email: 'email', emailid: 'email', mailid: 'email',
	fullname: 'name', name: 'name', title: 'title',
	doj: 'joining', joined: 'joining', joining: 'joining', hire: 'joining', hired: 'joining', join: 'joining', start: 'start',
	designation: 'role', position: 'role', role: 'role', job: 'role',
	mgr: 'manager', manager: 'manager', supervisor: 'manager', reports: 'manager', reporting: 'manager', reportsto: 'manager',
	dept: 'team', department: 'team', team: 'team', group: 'team', squad: 'team',
	proj: 'project', project: 'project',
	hrs: 'hours', hour: 'hours', hours: 'hours', duration: 'hours',
	desc: 'description', description: 'description', details: 'description', notes: 'description', note: 'description', comments: 'description', comment: 'description', remarks: 'description',
	dt: 'date', date: 'date', day: 'date', on: '', of: '', the: '', a: '', normalized: '', fk: '',
	qty: 'quantity', quantity: 'quantity',
	amt: 'amount', amount: 'amount', cost: 'amount', price: 'amount',
	billable: 'billable', chargeable: 'billable',
	status: 'status', state: 'status', stage: 'status',
	prio: 'priority', priority: 'priority', severity: 'priority',
	type: 'type', kind: 'type', category: 'type',
	end: 'end', finish: 'end', due: 'due', deadline: 'due', completed: 'completed', done: 'completed', closed: 'completed',
	phone: 'phone', mobile: 'phone', contact: 'phone',
};
// Generic noise that carries no meaning on its own ("Employee Code" and "Employee ID" are the same thing).
const NOISE = new Set(['id', 'code', 'no', 'number', 'num', 'nr', 'ref', 'key', '']);

const words = (s) =>
	String(s)
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean);

const concept = (s) => {
	const joined = words(s).join('');
	const base = words(s).map((w) => (w in CANON ? CANON[w] : w));
	if (joined in CANON) return new Set([CANON[joined]].filter(Boolean));
	return new Set(base.filter((w) => w && !NOISE.has(w)));
};

const flat = (s) => words(s).join('');

/** Jaro-Winkler similarity, 0..1. */
export function jaroWinkler(a, b) {
	if (a === b) return 1;
	if (!a || !b) return 0;
	const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
	const am = new Array(a.length).fill(false);
	const bm = new Array(b.length).fill(false);
	let matches = 0;
	for (let i = 0; i < a.length; i++) {
		const lo = Math.max(0, i - range);
		const hi = Math.min(b.length - 1, i + range);
		for (let j = lo; j <= hi; j++) {
			if (!bm[j] && a[i] === b[j]) {
				am[i] = bm[j] = true;
				matches++;
				break;
			}
		}
	}
	if (!matches) return 0;
	let t = 0;
	let k = 0;
	for (let i = 0; i < a.length; i++) {
		if (!am[i]) continue;
		while (!bm[k]) k++;
		if (a[i] !== b[k]) t++;
		k++;
	}
	const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
	let prefix = 0;
	while (prefix < 4 && a[prefix] && a[prefix] === b[prefix]) prefix++;
	return jaro + prefix * 0.1 * (1 - jaro);
}

/** How alike two names are, 0..1: identical text, same concepts, or similar spelling. */
export function nameScore(header, field) {
	const hf = flat(header);
	const ff = flat(field);
	if (!hf) return 0;
	if (hf === ff) return 1;
	const hc = concept(header);
	const fc = concept(field);
	let best = jaroWinkler(hf, ff) * 0.8;
	if (hc.size && fc.size) {
		const inter = [...hc].filter((w) => fc.has(w)).length;
		const union = new Set([...hc, ...fc]).size;
		const jaccard = inter / union;
		if (jaccard === 1) best = Math.max(best, 0.93); // same concepts, different words (Staff No = Employee Code)
		else if (inter) best = Math.max(best, 0.5 + 0.4 * jaccard); // partly the same ("Joined On" vs "joining_date")
	}
	return Math.min(best, 0.99);
}

// ---- what the values look like ------------------------------------------------------------------

const DATE = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})([ T].*)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NUMBER = /^-?\d+([.,]\d+)?$/;

/** Share (0..1) of the non-empty values that fit the field's type; null when there is nothing to judge by. */
export function fit(values, column) {
	const v = values.filter((x) => x !== '' && x != null).slice(0, 25);
	if (!v.length) return null;
	const share = (test) => v.filter(test).length / v.length;
	switch (column.type) {
		case 'date':
			return share((x) => DATE.test(x));
		case 'num':
		case 'int':
		case 'number':
		case 'decimal':
			return share((x) => NUMBER.test(x));
		case 'enum':
			return column.values ? share((x) => column.values.includes(String(x).toLowerCase().replace(/[\s-]+/g, '_'))) : null;
		case 'bool':
			return share((x) => /^(true|false|yes|no|y|n|0|1)$/i.test(x));
		default:
			if (/email/i.test(column.field)) return share((x) => EMAIL.test(x));
			return null;
	}
}

const columnValues = (cells, i) => cells.slice(0, 25).map((r) => String((r && r[i]) ?? '').trim());

/**
 * Matches the headers of a file to template columns. `cells` are the data rows (arrays) so values can break ties
 * ("Joined On" holding dates is a date field, an email column is the email field even if it is called "Contact").
 */
export function matchHeaders(headers, cells, columns) {
	const pairs = [];
	headers.forEach((h, i) => {
		if (!String(h).trim()) return;
		const values = columnValues(cells || [], i);
		columns.forEach((col) => {
			let score = nameScore(h, col.field);
			const f = fit(values, col);
			if (f !== null) {
				if (f >= 0.8) score = Math.min(1, score + 0.12 + (score < MEDIUM ? 0.1 : 0)); // the values agree
				if (f >= 0.95 && /email/i.test(col.field)) score = Math.max(score, MEDIUM + 0.01); // addresses are unmistakable
				else if (f < 0.4) score *= 0.45; // the values clearly are not this kind of data
			}
			if (col.required) score += 0.005; // a required field wins a tie
			if (score >= MEDIUM) pairs.push({ i, field: col.field, score });
		});
	});
	pairs.sort((a, b) => b.score - a.score);
	const out = headers.map(() => null);
	const used = new Set();
	for (const p of pairs) {
		if (out[p.i] || used.has(p.field)) continue;
		out[p.i] = { field: p.field, score: Math.min(p.score, 1), confidence: p.score >= HIGH ? 'high' : 'medium' };
		used.add(p.field);
	}
	return out;
}

/** A stable fingerprint of a file's header row, to remember a mapping the user confirmed for the same file shape. */
export const headerSignature = (headers) => headers.map((h) => flat(h)).join('|');

// ---- remembered mappings (this device) ---------------------------------------------------------

const STORE_KEY = 'company360.importMaps';
const MAX_SAVED = 30;

function readStore() {
	try {
		const v = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

/** The mapping the user confirmed last time for this module and header row, as field names per header (or null). */
export function rememberedMapping(module, headers, columns) {
	const saved = readStore()[`${module}|${headerSignature(headers)}`];
	if (!Array.isArray(saved) || saved.length !== headers.length) return null;
	const known = new Set(columns.map((c) => c.field));
	return saved.map((f) => (f && known.has(f) ? f : null));
}

export function rememberMapping(module, headers, mapping) {
	try {
		const store = readStore();
		store[`${module}|${headerSignature(headers)}`] = mapping;
		const keys = Object.keys(store);
		keys.slice(0, Math.max(0, keys.length - MAX_SAVED)).forEach((k) => delete store[k]);
		window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
	} catch {
		/* a full or blocked store only means the mapping is asked again next time */
	}
}
