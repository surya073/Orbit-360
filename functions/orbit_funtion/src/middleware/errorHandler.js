'use strict';

const { ApiError, classifyDbError } = require('../utils/errors');

/**
 * Converts any thrown value into the client error contract. Internal details (messages that
 * may include row values, stack traces) go to the structured log only, never to the client.
 */
function toErrorResponse(err, ctx) {
	const apiErr = err instanceof ApiError ? err : classifyDbError(err).error;
	if (apiErr.status >= 500) {
		// Stack frames only: the first stack line repeats err.message, which may contain row values.
		const frames = err && typeof err.stack === 'string' ? err.stack.split(/\r?\n/).slice(1, 9).map((l) => l.trim()) : undefined;
		ctx.logger.error('request_failed', { code: apiErr.code, errClass: err && err.constructor && err.constructor.name, frames });
	} else {
		ctx.logger.info('request_rejected', { status: apiErr.status, code: apiErr.code });
	}
	return {
		status: apiErr.status,
		body: { ok: false, requestId: ctx.requestId, error: { code: apiErr.code, message: apiErr.message, details: apiErr.details } },
	};
}

module.exports = { toErrorResponse };
