'use strict';

/**
 * Route-level input validation. A route declares `validate: { params, query, body }`, each a
 * function (raw) => parsed (throwing ApiError on bad input). Parsed values replace the raw
 * ones in ctx.input so handlers never touch unvalidated data.
 */
function runValidators(ctx, validate, body) {
	const v = validate || {};
	ctx.input = {
		params: v.params ? v.params(ctx.params) : ctx.params,
		query: v.query ? v.query(ctx.query) : ctx.query,
		body: v.body ? v.body(body) : body,
	};
}

module.exports = { runValidators };
