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
			execute('GET', path, opts).then((out) => {
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
