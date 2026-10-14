'use strict';

const { ok, paged } = require('../utils/response');
const presentations = require('../services/presentation.service');

module.exports = {
	list: async (ctx) => {
		const r = await presentations.list(ctx, ctx.input.query.paging);
		return paged(r.rows, r);
	},
	get: async (ctx) => ok(await presentations.get(ctx, ctx.input.params.id)),
	create: async (ctx) => ({ status: 201, body: ok(await presentations.create(ctx, ctx.input.body)) }),
	update: async (ctx) => ok(await presentations.update(ctx, ctx.input.params.id, ctx.input.body)),
	remove: async (ctx) => ok(await presentations.remove(ctx, ctx.input.params.id)),
	markPresented: async (ctx) => ok(await presentations.markPresented(ctx, ctx.input.params.id)),
};
