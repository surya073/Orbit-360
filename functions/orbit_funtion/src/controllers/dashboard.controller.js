'use strict';

const { ok, paged } = require('../utils/response');
const dashboard = require('../services/dashboard.service');

module.exports = {
	overview: async (ctx) => ok(await dashboard.overview(ctx, ctx.input.query)),
	trends: async (ctx) => ok(await dashboard.trends(ctx, ctx.input.query)),
	projects: async (ctx) => ok(await dashboard.projects(ctx, ctx.input.query)),
	product: async (ctx) => ok(await dashboard.product(ctx, ctx.input.query)),
	aiUsage: async (ctx) => ok(await dashboard.aiUsage(ctx, ctx.input.query)),
	freshness: async (ctx) => ok(await dashboard.freshness(ctx, ctx.input.query)),
	peopleProfiles: async (ctx) => ok(await dashboard.peopleProfiles(ctx, ctx.input.query, ctx.input.query.employeeIds)),
	createSnapshot: async (ctx) => ({ status: 201, body: ok(await dashboard.createSnapshot(ctx, ctx.input.body)) }),
	listSnapshots: async (ctx) => {
		const r = await dashboard.listSnapshots(ctx, ctx.input.query.paging);
		return paged(r.rows, r);
	},
	getSnapshot: async (ctx) => ok(await dashboard.getSnapshot(ctx, ctx.input.params.id)),
};
