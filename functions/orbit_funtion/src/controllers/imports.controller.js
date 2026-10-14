'use strict';

const { ok, paged } = require('../utils/response');
const imports = require('../services/import.service');

module.exports = {
	templates: async () => ok(imports.templates()),
	createJob: async (ctx) => ({ status: 201, body: ok(await imports.createJob(ctx, ctx.input.body)) }),
	getJob: async (ctx) => ok(await imports.getJob(ctx, ctx.input.params.id)),
	listRows: async (ctx) => {
		const r = await imports.listRows(ctx, ctx.input.params.id, ctx.input.query);
		return paged(r.rows, r);
	},
	preview: async (ctx) => ok(await imports.previewBatch(ctx, ctx.input.params.id, ctx.input.body.rows)),
	resolve: async (ctx) => ok(await imports.resolveConflicts(ctx, ctx.input.params.id, ctx.input.body.resolutions)),
	commit: async (ctx) => ok(await imports.commitBatch(ctx, ctx.input.params.id, ctx.input.body.rows)),
	complete: async (ctx) => ok(await imports.completeJob(ctx, ctx.input.params.id)),
	cancel: async (ctx) => ok(await imports.cancelJob(ctx, ctx.input.params.id)),
};
