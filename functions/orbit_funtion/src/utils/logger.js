'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
// Keys that may carry personal data; never logged even if passed by mistake.
const SENSITIVE = /email|name|reason|description|comment|phone|address|password|token|secret|more_details|payload|body|rows?$/i;

function scrub(value, depth = 0) {
	if (value === null || typeof value !== 'object' || depth > 3) return typeof value === 'string' && value.length > 200 ? `${value.slice(0, 200)}…` : value;
	if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
	const out = {};
	for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v, depth + 1);
	return out;
}

/** Structured JSON logger. `base` (e.g. requestId) is attached to every line. */
function createLogger(base = {}, level = 'info', sink = console) {
	const min = LEVELS[level] || LEVELS.info;
	const log = (lvl, msg, fields) => {
		if (LEVELS[lvl] < min) return;
		const line = JSON.stringify({ level: lvl, msg, ...base, ...scrub(fields || {}) });
		(lvl === 'error' ? sink.error : lvl === 'warn' ? sink.warn : sink.log)(line);
	};
	return {
		debug: (m, f) => log('debug', m, f),
		info: (m, f) => log('info', m, f),
		warn: (m, f) => log('warn', m, f),
		error: (m, f) => log('error', m, f),
		child: (more) => createLogger({ ...base, ...more }, level, sink),
	};
}

module.exports = { createLogger, scrub };
