'use strict';

const { errors } = require('../utils/errors');
const { requireScope } = require('../services/scope.service');

/** Role gate. Usage in route definitions: roles: ['admin']. Omitted = any provisioned role. */
function requireRole(ctx, roles) {
	if (roles && !roles.includes(ctx.actor.role)) throw errors.forbidden('Administrator access required');
}

/** Authorization step: role check, then derive the Scope every service/repository call needs. */
function authorize(ctx, route) {
	requireRole(ctx, route.roles);
	ctx.scope = requireScope(ctx.actor);
}

module.exports = { authorize, requireRole, requireScope };
