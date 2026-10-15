'use strict';

/**
 * In-memory stand-in for the Catalyst SDK, used only by tests. It interprets the ZCQL shapes
 * this codebase emits (SELECT / COUNT / SUM ... GROUP BY / WHERE with = >= <= IN LIKE IS NULL
 * joined by AND) and the datastore insert/update calls, including unique-key rejection.
 * Booleans are stored as the strings "true"/"false", like the real Data Store.
 */

const UNIQUE = {
	employees: ['email_normalized', 'employee_code'],
	teams: ['team_code'],
	users: ['catalyst_user_id', 'email'],
};
const UNIQUE_ALL = ['dedupe_key'];

function parseValue(raw) {
	const v = raw.trim();
	if (/^'.*'$/.test(v)) return v.slice(1, -1);
	return v; // numbers / true / false stay as their string form; comparisons are string-based
}

function condFn(cond) {
	let m;
	if ((m = /^\((.+ OR .+)\)$/.exec(cond))) {
		const fns = m[1].split(' OR ').map(condFn);
		return (r) => fns.some((fn) => fn(r));
	}
	if ((m = /^(\w+) IS NULL$/.exec(cond))) return (r) => r[m[1]] === null || r[m[1]] === undefined;
	if ((m = /^(\w+) IN \((.*)\)$/.exec(cond))) {
		const set = new Set(m[2].split(',').map(parseValue));
		return (r) => r[m[1]] !== undefined && set.has(String(r[m[1]]));
	}
	if ((m = /^(\w+) LIKE '%(.*)%'$/.exec(cond))) return (r) => String(r[m[1]] || '').toLowerCase().includes(m[2].toLowerCase());
	if ((m = /^(\w+) (=|>=|<=) (.+)$/.exec(cond))) {
		const [, col, op, rawV] = m;
		const v = parseValue(rawV);
		return (r) => {
			if (r[col] === undefined || r[col] === null) return false;
			const s = String(r[col]);
			return op === '=' ? s === v : op === '>=' ? s >= v : s <= v;
		};
	}
	throw new Error(`memoryCatalyst: unsupported condition: ${cond}`);
}

function createStore(seed = {}) {
	const tables = {};
	const seq = {};
	const store = {
		tables,
		queries: [],
		rows: (t) => (tables[t] ||= []),
		insert(t, row) {
			const rows = store.rows(t);
			for (const col of [...(t === 'import_jobs' ? [] : UNIQUE_ALL), ...(UNIQUE[t] || [])]) { // import_jobs.dedupe_key is intentionally not unique
				if (row[col] !== undefined && row[col] !== null && rows.some((r) => r[col] === row[col])) throw new Error(`Duplicate value for ${col}`);
			}
			seq[t] = (seq[t] || 1000) + 1;
			const full = { ...row, ROWID: String(seq[t]), CREATEDTIME: '2026-10-01 10:00:00' };
			rows.push(full);
			return { ...full };
		},
	};
	for (const [t, rows] of Object.entries(seed)) rows.forEach((r) => store.insert(t, r));
	return store;
}

function select(store, sql, style = 'alias') {
	const m = /^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: GROUP BY (.+?))?(?: ORDER BY .+?)?(?: LIMIT (\d+), (\d+))?$/.exec(sql.trim());
	if (!m) throw new Error(`memoryCatalyst: unsupported query: ${sql}`);
	const [, colsRaw, table, whereRaw, groupRaw, off, cnt] = m;
	let rows = store.rows(table);
	if (whereRaw) {
		const fns = whereRaw.split(' AND ').map(condFn);
		rows = rows.filter((r) => fns.every((fn) => fn(r)));
	}
	const items = colsRaw.split(',').map((s) => s.trim());
	const aggs = items.filter((i) => /\(/.test(i));

	if (aggs.length) {
		const groupCols = groupRaw ? groupRaw.split(',').map((s) => s.trim()) : [];
		const groups = new Map();
		for (const r of rows) {
			const key = groupCols.map((c) => String(r[c])).join('\u0001');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(r);
		}
		if (groupCols.length === 0 && groups.size === 0) groups.set('', []);
		const out = [];
		for (const g of groups.values()) {
			const row = {};
			for (const c of groupCols) if (g[0]) row[c] = g[0][c];
			for (const a of aggs) {
				const am = /^(COUNT|SUM|AVG|MAX)\((\w+)\) AS (\w+)$/.exec(a);
				if (!am) throw new Error(`memoryCatalyst: unsupported aggregate ${a}`);
				const [, fn, col, aliasName] = am;
				// style 'expression': the platform may name aggregate columns by their expression text
				const alias = style === 'expression' ? `${fn}(${col})` : aliasName;
				const vals = g.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
				if (fn === 'COUNT') row[alias] = String(g.length);
				else if (fn === 'MAX') row[alias] = vals.length ? vals.map(String).sort().pop() : null;
				else {
					const nums = vals.map(Number);
					row[alias] = nums.length ? String(fn === 'SUM' ? nums.reduce((x, y) => x + y, 0) : nums.reduce((x, y) => x + y, 0) / nums.length) : null;
				}
			}
			out.push({ [table]: row });
		}
		return out;
	}

	const start = off ? Number(off) : 0;
	const page = rows.slice(start, cnt ? start + Number(cnt) : undefined);
	const star = items.length === 1 && items[0] === '*';
	return page.map((r) => ({ [table]: star ? { ...r } : Object.fromEntries(items.map((c) => [c, r[c]]).filter(([, v]) => v !== undefined)) }));
}

/**
 * Builds a fake `catalyst` module. Identity comes from the `x-test-user` request header
 * (a Catalyst user id); missing header = not signed in.
 */
function createMemoryCatalyst(store, { latencyMs = 0, hooks = {}, aggregateKeys = 'alias' } = {}) {
	const pause = () => (latencyMs ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve());
	const admin = {
		zcql: () => ({
			executeZCQLQuery: async (sql) => {
				store.queries.push(sql);
				await pause();
				return select(store, sql, aggregateKeys);
			},
		}),
		datastore: () => ({
			table: (name) => ({
				insertRow: async (row) => store.insert(name, row),
				insertRows: async (rows) => {
					store.queries.push(`BULK INSERT ${name} x${rows.length}`);
					if (hooks.beforeBulkInsert) await hooks.beforeBulkInsert(name, rows, store);
					const staged = createStore();
					for (const t of Object.keys(store.tables)) staged.tables[t] = store.tables[t].map((r) => ({ ...r }));
					rows.forEach((r) => staged.insert(name, r)); // throws before mutating the real store
					const written = rows.map((r) => store.insert(name, r));
					if (hooks.afterBulkInsert) await hooks.afterBulkInsert(name, written, store); // e.g. throw: write landed, response lost
					return written;
				},
				updateRow: async (row) => {
					const t = store.rows(name).find((r) => r.ROWID === String(row.ROWID));
					if (!t) throw new Error('Row not found');
					Object.assign(t, row);
					return { ...t };
				},
				updateRows: async (rows) => rows.map((row) => Object.assign(store.rows(name).find((r) => r.ROWID === String(row.ROWID)), row)),
			}),
		}),
	};
	return {
		initialize(req, opts = {}) {
			if (opts.scope === 'admin') return admin;
			const id = req.headers['x-test-user'];
			return { userManagement: () => ({ getCurrentUser: async () => (id ? { user_id: id } : null) }) };
		},
	};
}

/** Minimal req/res pair for driving the Advanced I/O handler without a server. */
function call(handler, { method = 'GET', url, user, body } = {}) {
	return new Promise((resolve) => {
		const req = { method, url, headers: user ? { 'x-test-user': String(user) } : {}, body };
		const res = {
			headersSent: false,
			writeHead(status) {
				this.status = status;
			},
			end(payload) {
				this.headersSent = true;
				resolve({ status: this.status, body: JSON.parse(payload) });
			},
		};
		handler(req, res);
	});
}

module.exports = { createStore, createMemoryCatalyst, call };
