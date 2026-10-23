'use strict';

const { ok } = require('../utils/response');
const schema = require('../services/schema.service');

module.exports = {
	schema: async (ctx) => ok(await schema.check(ctx)),
};
