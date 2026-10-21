'use strict';

/** Error that maps directly onto the API error contract. Safe to show to clients. */
class ApiError extends Error {
	constructor(status, code, message, details) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

const errors = {
	badRequest: (message, details) => new ApiError(400, 'BAD_REQUEST', message, details),
	validation: (details) => new ApiError(422, 'VALIDATION_FAILED', 'Input failed validation', details),
	unauthenticated: (message = 'Authentication required') => new ApiError(401, 'UNAUTHENTICATED', message),
	forbidden: (message = 'You do not have access to this resource', code = 'FORBIDDEN') => new ApiError(403, code, message),
	notFound: (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message),
	methodNotAllowed: () => new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed'),
	conflict: (message, details) => new ApiError(409, 'CONFLICT', message, details),
	payloadTooLarge: () => new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'),
	timeout: () => new ApiError(504, 'TIMEOUT', 'The request took too long. Narrow the filters and try again.'),
	budget: () => new ApiError(503, 'QUERY_BUDGET_EXCEEDED', 'The request needed too many database queries. Narrow the filters and try again.'),
};

/**
 * Classifies SDK/Data Store failures into API errors. Raw messages may contain row values
 * (personal data), so they are never forwarded and only the class is logged.
 */
function classifyDbError(err) {
	const msg = String((err && err.message) || err || '');
	if (err instanceof ApiError) return { error: err, kind: 'api' };
	if (/duplicate/i.test(msg) || /unique/i.test(msg)) return { error: errors.conflict('A record with the same unique value already exists'), kind: 'duplicate' };
	if (/column.*not found|table.*not found|invalid (column|table)|no such/i.test(msg)) return { error: new ApiError(500, 'DATASTORE_SCHEMA', 'The data model does not match the server configuration'), kind: 'schema' };
	if (/privilege|permission|not authori[sz]ed/i.test(msg)) return { error: new ApiError(500, 'DATASTORE_PERMISSION', 'The server is not permitted to perform this data operation'), kind: 'permission' };
	if (/too many|rate|429|limit/i.test(msg)) return { error: new ApiError(503, 'DATASTORE_THROTTLED', 'The data service is busy. Retry shortly.'), kind: 'throttled' };
	if (/timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(msg)) return { error: new ApiError(504, 'DATASTORE_TIMEOUT', 'The data service did not respond in time. Retry shortly.'), kind: 'timeout' };
	return { error: new ApiError(500, 'INTERNAL_ERROR', 'Unexpected server error'), kind: 'unknown' };
}

module.exports = { ApiError, errors, classifyDbError };
