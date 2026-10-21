'use strict';

const { ok, paged } = require('../utils/response');
const access = require('../services/access.service');

module.exports = {
	catalog: async (ctx) => ok(await access.getCatalog(ctx)),
	listRoles: async (ctx) => ok(await access.listRoles(ctx)),
	createRole: async (ctx) => ({ status: 201, body: ok(await access.createRole(ctx, ctx.input.body)) }),
	updateRole: async (ctx) => ok(await access.updateRole(ctx, ctx.input.params.ref, ctx.input.body)),
	setPermissions: async (ctx) => ok(await access.setRolePermissions(ctx, ctx.input.params.ref, ctx.input.body.permissions)),
	listUsers: async (ctx) => {
		const r = await access.listUsers(ctx, ctx.input.query);
		return paged(r.rows, r);
	},
	inviteUser: async (ctx) => ({ status: 201, body: ok(await access.inviteUser(ctx, ctx.input.body)) }),
	getUserAccess: async (ctx) => ok(await access.getUserAccess(ctx, ctx.input.params.id)),
	setUserPermissions: async (ctx) => ok(await access.setUserPermissions(ctx, ctx.input.params.id, ctx.input.body)),
	updateUser: async (ctx) => ok(await access.updateUser(ctx, ctx.input.params.id, ctx.input.body)),
};
