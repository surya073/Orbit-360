'use strict';

const { ok, paged } = require('../utils/response');
const dashboard = require('../services/dashboard.service');

/** Run one section; a failure becomes that section's error so the other five still arrive. */
async function section(ctx, fn) {
	try {
		return { ok: true, data: await fn() };
	} catch (e) {
		if (e && e.name === 'ApiError') return { ok: false, error: { status: e.status, code: e.code, message: e.message } };
		if (ctx.logger && ctx.logger.error) ctx.logger.error('dashboard.bundle.section_failed', { name: e && e.name });
		return { ok: false, error: { status: 500, code: 'INTERNAL_ERROR', message: 'This section could not be loaded.' } };
	}
}

module.exports = {
	bundle: async (ctx) => {
		const { base, trend } = ctx.input.query;
		ctx.scope.resolveTeam(base.teamId); // a manager asking for another team is refused for the whole request (403)
		const [overview, trends, projects, product, ai, freshness] = await Promise.all([
			section(ctx, () => dashboard.overview(ctx, base)),
			section(ctx, () => dashboard.trends(ctx, trend)),
			section(ctx, () => dashboard.projects(ctx, base)),
			section(ctx, () => dashboard.product(ctx, base)),
			section(ctx, () => dashboard.aiUsage(ctx, base)),
			section(ctx, () => dashboard.freshness(ctx, base)),
		]);
		return ok({ overview, trends, projects, product, ai, freshness });
	},
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
