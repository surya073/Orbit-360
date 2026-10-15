import env from '../config/env';

/** Error contract: every failed call rejects with an ApiClientError (or an AbortError). */
export class ApiClientError extends Error {
	constructor({ status, code, message, details, requestId }) {
		super(message);
		this.name = 'ApiClientError';
		this.status = status;
		this.code = code;
		this.details = details;
		this.requestId = requestId;
	}
	get isAuth() {
		return this.status === 401;
	}
	get isForbidden() {
		return this.status === 403;
	}
	/** field -> message for 422 responses */
	get fieldErrors() {
		if (this.code !== 'VALIDATION_FAILED' || !Array.isArray(this.details)) return {};
		return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field, d.message]));
	}
}

export function toQuery(params = {}) {
	const sp = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
	});
	const s = sp.toString();
	return s ? `?${s}` : '';
}

// Identical in-flight GETs share one request (StrictMode, sibling components).
const inflight = new Map();

// Reads are idempotent, so a busy or cold backend is retried quietly instead of failing a card.
// Only transient failures retry (offline, gateway/timeout, or the Data Store's own busy/timeout codes).
export const readPolicy = { retries: 2, delays: [700, 1800], maxParallel: 3 };

const transient = (e) => e && e.name === 'ApiClientError' && (e.status === 0 || e.status === 429 || e.status === 502 || e.status === 504 || e.code === 'DATASTORE_THROTTLED' || e.code === 'DATASTORE_TIMEOUT');

const sleep = (ms, signal) =>
	new Promise((resolve, reject) => {
		if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
		const t = setTimeout(resolve, ms);
		if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
	});

// A dashboard opens six reads at once; running them all together is what trips the Data Store's
// concurrency limit. A small queue keeps the first cards fast and the rest reliable.
let running = 0;
const waiting = [];
function acquire(signal) {
	if (running < readPolicy.maxParallel) {
		running += 1;
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const entry = { resolve: () => { running += 1; resolve(); } };
		waiting.push(entry);
		if (signal) signal.addEventListener('abort', () => {
			const i = waiting.indexOf(entry);
			if (i >= 0) { waiting.splice(i, 1); reject(new DOMException('Aborted', 'AbortError')); }
		}, { once: true });
	});
}
function release() {
	running -= 1;
	const next = waiting.shift();
	if (next) next.resolve();
}

async function executeRead(path, opts) {
	for (let attempt = 0; ; attempt += 1) {
		await acquire(opts.signal);
		try {
			return await execute('GET', path, opts);
		} catch (err) {
			if (attempt >= readPolicy.retries || !transient(err)) throw err;
		} finally {
			release();
		}
		await sleep(readPolicy.delays[Math.min(attempt, readPolicy.delays.length - 1)], opts.signal);
	}
}

async function execute(method, path, { params, body, signal } = {}) {
	let res;
	try {
		res = await fetch(`${env.apiBase}${path}${toQuery(params)}`, {
			method,
			credentials: 'include', // Catalyst session cookie; no tokens are held in JS
			signal,
			headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	} catch (err) {
		if (err && err.name === 'AbortError') throw err;
		throw new ApiClientError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach the server. Check your connection and try again.' });
	}
	let payload = null;
	try {
		payload = await res.json();
	} catch {
		/* non-JSON (e.g. gateway error page) handled below */
	}
	if (!res.ok || !payload || payload.ok !== true) {
		const e = (payload && payload.error) || {};
		throw new ApiClientError({
			status: res.status,
			code: e.code || 'HTTP_ERROR',
			message: e.message || `Request failed (${res.status})`,
			details: e.details,
			requestId: payload && payload.requestId,
		});
	}
	return { data: payload.data, meta: payload.meta || null };
}

// Short-lived, in-memory (never persisted) cache of successful GETs. Every backend read costs
// billed Data Store requests, so going back to a page or re-selecting a filter within a minute
// reuses the answer. Any write, Reload or sign-in change clears it, so edits are never hidden.
const CACHE_TTL_MS = 60000;
const CACHE_MAX = 80;
const cache = new Map();

export function clearApiCache() {
	cache.clear();
}

function remember(key, value) {
	if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
	cache.set(key, { value, until: Date.now() + CACHE_TTL_MS });
}

async function write(method, path, opts) {
	try {
		return await execute(method, path, opts);
	} finally {
		clearApiCache(); // also on failure: a partly applied write may have changed data
	}
}

export const api = {
	get(path, opts = {}) {
		const key = `${path}${toQuery(opts.params)}`;
		// `fresh: true` (e.g. the spreadsheet's pre-save conflict check) must never see cached data.
		const hit = opts.fresh ? null : cache.get(key);
		if (hit && hit.until > Date.now()) return Promise.resolve(hit.value);
		cache.delete(key);
		const run = () =>
			executeRead(path, opts).then((out) => {
				remember(key, out);
				return out;
			});
		// Requests with a signal are caller-owned (abortable); only unsignalled GETs are shared.
		if (opts.signal) return run();
		if (opts.fresh) return run();
		if (!inflight.has(key)) inflight.set(key, run().finally(() => inflight.delete(key)));
		return inflight.get(key);
	},
	post: (path, body, opts) => write('POST', path, { ...opts, body: body ?? {} }),
	put: (path, body, opts) => write('PUT', path, { ...opts, body }),
	patch: (path, body, opts) => write('PATCH', path, { ...opts, body }),
	delete: (path, opts) => write('DELETE', path, opts),
};
