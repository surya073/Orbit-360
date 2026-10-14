'use strict';

const { ok } = require('../utils/response');
const settings = require('../services/settings.service');

module.exports = {
	list: async (ctx) => ok(await settings.list(ctx)),
	upsert: async (ctx) => ok(await settings.upsert(ctx, ctx.input.body)),
};
