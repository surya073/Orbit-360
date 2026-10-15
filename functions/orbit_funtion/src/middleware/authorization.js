'use strict';

const { errors } = require('../utils/errors');
const { requireScope } = require('../services/scope.service');
const { ACTIONS, MODULES } = require('../config/permissions');

const moduleLabel = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

/** Does the signed-in actor hold this permission key (for example "employees.edit")? */
const can = (actor, key) => Boolean(actor && actor.permissions && actor.permissions.has(key));

/** "employees.edit" -> "edit Employees" for error messages. */
const describe = (key) => {
	const [module, action] = String(key).split('.');
	const verb = ACTIONS[action] ? ACTIONS[action].label.toLowerCase() : action;
	return `${verb} ${moduleLabel[module] || module}`;
};

/** Throws 403 unless the actor holds EVERY listed permission. Missing information means no. */
function requirePermission(ctx, ...keys) {
	for (const key of keys.flat()) {
		if (!can(ctx.actor, key)) throw errors.forbidden(`You do not have permission to ${describe(key)}`, 'PERMISSION_DENIED');
	}
}

/**
 * Authorization step. Default-deny: a route must either declare the permission(s) it needs
 * (`permission: 'employees.view'`, or an array that must ALL be held) or be explicitly `open`
 * (any provisioned user, e.g. "who am I"). A route that declares neither is refused, so a new
 * endpoint can never be reachable by accident. Then the team Scope is derived for the data layer.
 */
function authorize(ctx, route) {
	ctx.scope = requireScope(ctx.actor);
	if (route.open) return;
	if (!route.permission) throw errors.forbidden('This operation is not available', 'NO_PERMISSION_DECLARED');
	requirePermission(ctx, route.permission);
}

module.exports = { authorize, requirePermission, can, describe, requireScope };
