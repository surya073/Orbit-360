'use strict';

const { LIMITS } = require('./constants');

/** Reads an integer env var, clamped to [min, max]; falls back when unset or invalid. */
function intVar(env, name, fallback, min, max) {
	const raw = env[name];
	if (raw === undefined || raw === '') return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n)) return fallback;
	return Math.min(Math.max(n, min), max);
}

/**
 * Runtime configuration. Set via Catalyst function environment variables (never committed);
 * there are no secrets here - authentication/authorization rely on the Catalyst session.
 *
 *   REQUEST_TIMEOUT_MS   per-request deadline (Advanced I/O is killed at 30s)
 *   QUERY_BUDGET         max Data Store requests one API call may issue (Data Store is billed per request)
 *   USER_CACHE_SECONDS   how long a signed-in user's role/team row is reused per function instance (0 disables)
 *   IMPORT_BATCH_SIZE    rows per preview/commit call
 *   LOG_LEVEL            debug | info | warn | error
 *   INVITE_ROLE_ID          Catalyst Authentication role (Console > Authentication > Roles, e.g. "App User") given to invited people
 *   INVITE_REDIRECT_URL    where an invited person lands after setting their password (default: the app's own start page)
 *   INVITE_SENDER_EMAIL    sender of the invitation email; when set, the invitation uses our own subject and wording
 */
function loadEnvironment(env = process.env) {
	return Object.freeze({
		requestTimeoutMs: intVar(env, 'REQUEST_TIMEOUT_MS', 25000, 1000, 28000),
		queryBudget: intVar(env, 'QUERY_BUDGET', 30, 5, 100),
		userCacheSeconds: intVar(env, 'USER_CACHE_SECONDS', 60, 0, 600),
		importBatchSize: intVar(env, 'IMPORT_BATCH_SIZE', LIMITS.maxImportBatch, 1, LIMITS.maxImportBatch),
		logLevel: ['debug', 'info', 'warn', 'error'].includes(env.LOG_LEVEL) ? env.LOG_LEVEL : 'info',
		snapshotRetentionDays: intVar(env, 'SNAPSHOT_RETENTION_DAYS', 365, 1, 3650),
		// CATALYST_APP_ROLE_ID is kept as a fallback only: the Console rejects it as a reserved name.
		inviteRoleId: [env.INVITE_ROLE_ID, env.APP_ROLE_ID, env.CATALYST_APP_ROLE_ID].find((v) => /^\d{1,20}$/.test(v || '')) || '',
		inviteRedirectUrl: String(env.INVITE_REDIRECT_URL || '').slice(0, 300),
		inviteSender: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.INVITE_SENDER_EMAIL || '') ? env.INVITE_SENDER_EMAIL : '',
		isProduction: env.X_ZOHO_CATALYST_ENVIRONMENT === 'Production' || env.NODE_ENV === 'production',
	});
}

module.exports = { loadEnvironment, environment: loadEnvironment() };
