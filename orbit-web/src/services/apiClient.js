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

export const api = {
	get(path, opts = {}) {
		// Requests with a signal are caller-owned (abortable); only unsignalled GETs are shared.
		if (opts.signal) return execute('GET', path, opts);
		const key = `${path}${toQuery(opts.params)}`;
		if (!inflight.has(key)) {
			inflight.set(key, execute('GET', path, opts).finally(() => inflight.delete(key)));
		}
		return inflight.get(key);
	},
	post: (path, body, opts) => execute('POST', path, { ...opts, body: body ?? {} }),
	put: (path, body, opts) => execute('PUT', path, { ...opts, body }),
	patch: (path, body, opts) => execute('PATCH', path, { ...opts, body }),
	delete: (path, opts) => execute('DELETE', path, opts),
};
