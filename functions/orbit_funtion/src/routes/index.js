'use strict';

const { errors } = require('../utils/errors');
const { API_PREFIX } = require('../config/constants');

const groups = [
	require('./health.routes'),
	require('./dashboard.routes'),
	require('./employees.routes'),
	require('./teams.routes'),
	require('./projects.routes'),
	require('./timeEntries.routes'),
	require('./attendance.routes'),
	require('./leave.routes'),
	require('./performance.routes'),
	require('./aiUsage.routes'),
	require('./productItems.routes'),
	require('./imports.routes'),
	require('./presentations.routes'),
	require('./access.routes'),
	require('./reporting.routes'),
];

function compile(route, path) {
	const keys = [];
	const re = new RegExp(`^${path.replace(/:([a-z_]+)/g, (_, k) => (keys.push(k), '([A-Za-z0-9_]+)'))}$`);
	return { ...route, re, keys };
}

/** Patterns are compiled once at load. Public routes answer at the root and under the API prefix. */
const table = groups.flat().flatMap((r) => (r.public ? [compile(r, r.path), compile(r, `${API_PREFIX}${r.path}`)] : [compile(r, `${API_PREFIX}${r.path}`)]));

/** Returns { route, params }, or throws 404 (no such path) / 405 (path exists, wrong method). */
function match(method, path) {
	let pathMatched = false;
	for (const r of table) {
		const m = r.re.exec(path);
		if (!m) continue;
		pathMatched = true;
		if (r.method === method) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])) };
	}
	throw pathMatched ? errors.methodNotAllowed() : errors.notFound('Unknown endpoint');
}

module.exports = { match, routeTable: table };
