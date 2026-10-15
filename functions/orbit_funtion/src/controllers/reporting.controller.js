'use strict';

const { ok } = require('../utils/response');
const reporting = require('../services/reporting.service');

module.exports = {
	get: async (ctx) => ok(await reporting.get(ctx, ctx.input.query.teamId)),
	save: async (ctx) => ok(await reporting.save(ctx, ctx.input.body)),
};
