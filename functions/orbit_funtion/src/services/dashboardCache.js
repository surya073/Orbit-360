'use strict';

const MAX_ENTRIES = 300;

/**
 * Short-lived, per-function-instance cache for dashboard aggregates (Data Store is billed per request).
 *
 * Access safety: the key always starts with the caller's EFFECTIVE team scope ("all" or "team:<id>"), so
 * two people share an entry only when they would run the identical scoped query. It is consulted only
 * after authentication and the `dashboard.view` permission check. Any write request (POST/PUT/PATCH/
 * DELETE) clears it on the instance that handled it; other instances expire within `ttlSeconds`.
 * In-flight requests are shared and failures are never cached. 0 disables it.
 */
function createDashboardCache(ttlSeconds = 0) {
	const ttl = ttlSeconds * 1000;
	const map = new Map();

	const scopeKey = (scope) => (scope.isAdmin ? 'all' : `team:${scope.teamId}`);

	return {
		/** Returns the cached value for (scope, name, params) or runs `compute` and keeps its result. */
		wrap(scope, name, params, compute) {
			if (!ttl) return compute();
			const key = `${scopeKey(scope)}|${name}|${JSON.stringify(params)}`;
			const hit = map.get(key);
			if (hit && hit.until > Date.now()) return hit.promise;
			if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value);
			const promise = Promise.resolve().then(compute);
			map.set(key, { promise, until: Date.now() + ttl });
			promise.catch(() => map.get(key) && map.get(key).promise === promise && map.delete(key));
			return promise;
		},
		clear: () => map.clear(),
	};
}

module.exports = { createDashboardCache };
