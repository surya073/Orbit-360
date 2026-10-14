'use strict';

const { errors } = require('./errors');
const { LIMITS } = require('../config/constants');

/** Every list endpoint is paginated with an explicit, capped page size. */
function parsePaging(params = {}, { maxPageSize = LIMITS.maxPageSize, defaultPageSize = LIMITS.defaultPageSize } = {}) {
	const page = params.page === undefined ? 1 : Number(params.page);
	const pageSize = params.pageSize === undefined ? defaultPageSize : Number(params.pageSize);
	if (!Number.isInteger(page) || page < 1 || page > LIMITS.maxPage) throw errors.badRequest('page must be a positive integer');
	if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
		throw errors.badRequest(`pageSize must be between 1 and ${maxPageSize}`);
	}
	return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { parsePaging };
