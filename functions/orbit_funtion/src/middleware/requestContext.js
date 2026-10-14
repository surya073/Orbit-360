'use strict';

const crypto = require('crypto');
const { errors } = require('../utils/errors');
const { LIMITS } = require('../config/constants');

/** Per-request context: id, logger, deadline. Everything downstream reads from ctx. */
function createContext(req, { logger, timeoutMs }) {
	const url = new URL(req.url, 'http://localhost');
	const requestId = crypto.randomUUID();
	return {
		req,
		requestId,
		method: req.method,
		path: url.pathname.replace(/^\/execute(?=\/|$)/, '').replace(/\/+$/, '') || '/',
		query: Object.fromEntries(url.searchParams),
		logger: logger.child({ requestId }),
		startedAt: Date.now(),
		deadline: Date.now() + timeoutMs,
	};
}

/** Rejects once the deadline passes so the client gets a clean 504 before the platform's 30s kill. */
function withTimeout(promise, ms) {
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => reject(errors.timeout()), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function readJson(req) {
	if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (c) => {
			size += c.length;
			if (size > LIMITS.maxBodyBytes) {
				reject(errors.payloadTooLarge());
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on('end', () => {
			if (chunks.length === 0) return resolve({});
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
				if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return reject(errors.badRequest('Body must be a JSON object'));
				resolve(parsed);
			} catch {
				reject(errors.badRequest('Body is not valid JSON'));
			}
		});
		req.on('error', reject);
	});
}

module.exports = { createContext, withTimeout, readJson };
