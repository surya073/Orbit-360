'use strict';

const { environment: defaultEnv } = require('./config/environment');
const { createDb } = require('./config/datastore');
const { createLogger } = require('./utils/logger');
const { send } = require('./utils/response');
const { createContext, withTimeout, readJson } = require('./middleware/requestContext');
const { authenticate } = require('./middleware/authentication');
const { authorize } = require('./middleware/authorization');
const { runValidators } = require('./middleware/validation');
const { toErrorResponse } = require('./middleware/errorHandler');
const { createRepositories } = require('./repositories');
const { match } = require('./routes');
const { errors } = require('./utils/errors');

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Builds the request handler. Catalyst Advanced I/O invokes a plain (req, res) function per
 * request - there is no listening server - so this is a pipeline of middleware steps rather
 * than an Express app, which would add a dependency without adding capability here.
 *
 *   context -> route match -> authenticate -> authorize(scope) -> body -> validate -> handler
 *
 * `catalyst` is injected so tests can supply a fake SDK.
 * Timeout note: a timed-out request returns 504 but already-issued Data Store writes cannot
 * be cancelled; import commits are idempotent for exactly this reason.
 */
function createApp({ catalyst, env = defaultEnv, logger = createLogger({}, env.logLevel) }) {
	async function pipeline(ctx, req, res) {
		const { route, params } = match(ctx.method, ctx.path);
		ctx.params = params;
		ctx.route = `${route.method} ${route.path}`;

		if (route.public) {
			send(res, 200, { ...(await route.handler(ctx)), requestId: ctx.requestId });
			return 200;
		}

		// Data access uses the admin-scope SDK; identity uses the caller-scope SDK. Authorization
		// happens in this app (role + team scope), never by trusting the client.
		let adminApp;
		let userApp;
		try {
			adminApp = catalyst.initialize(req, { scope: 'admin' });
			userApp = catalyst.initialize(req);
		} catch (err) {
			// No Catalyst session context (e.g. called outside Catalyst, or credentials missing): fail closed.
			ctx.logger.warn('catalyst_init_failed', { errClass: err && err.constructor && err.constructor.name });
			throw errors.unauthenticated('Request is not running inside a Catalyst session');
		}
		ctx.db = createDb(adminApp, { budget: route.budget || env.queryBudget, logger: ctx.logger });
		ctx.repos = createRepositories(ctx.db);
		ctx.actor = await authenticate(userApp, ctx.repos.users);
		authorize(ctx, route);

		const body = BODY_METHODS.has(ctx.method) ? await readJson(req) : {};
		runValidators(ctx, route.validate, body);

		const result = await route.handler(ctx);
		const status = (result && result.status) || 200;
		send(res, status, { ...((result && result.body) || result), requestId: ctx.requestId });
		return status;
	}

	return async function handle(req, res) {
		const ctx = createContext(req, { logger, timeoutMs: env.requestTimeoutMs });
		try {
			const status = await withTimeout(pipeline(ctx, req, res), env.requestTimeoutMs);
			ctx.logger.info('request_completed', { route: ctx.route, status, ms: Date.now() - ctx.startedAt, ...(ctx.db ? ctx.db.stats() : {}) });
		} catch (err) {
			const { status, body } = toErrorResponse(err, ctx);
			send(res, status, body);
		}
	};
}

module.exports = { createApp };
