'use strict';

const { ok, paged } = require('../utils/response');
const crud = require('../services/crud.service');

/** Thin HTTP adapter over crud.service for one resource. Inputs arrive validated in ctx.input. */
function crudController(name) {
	return {
		list: async (ctx) => {
			const r = await crud.list(ctx, name, ctx.input.query);
			return paged(r.rows, r);
		},
		get: async (ctx) => ok(await crud.get(ctx, name, ctx.input.params.id)),
		create: async (ctx) => ({ status: 201, body: ok(await crud.create(ctx, name, ctx.input.body)) }),
		update: async (ctx) => ok(await crud.update(ctx, name, ctx.input.params.id, ctx.input.body)),
		remove: async (ctx) => ok(await crud.remove(ctx, name, ctx.input.params.id)),
	};
}

module.exports = { crudController };
