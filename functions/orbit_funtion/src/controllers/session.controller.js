'use strict';

const { ok } = require('../utils/response');

/** The caller's verified identity, role and team, as the frontend should render them. */
const me = async ({ actor }) =>
	ok({
		userId: actor.userId,
		email: actor.email,
		displayName: actor.displayName,
		role: actor.role, // legacy: "admin" = sees every team, "manager" = one team
		roleKey: actor.roleKey,
		roleName: actor.roleName,
		scopeType: actor.scopeType,
		teamId: actor.teamId,
		permissions: [...actor.permissions].sort(), // what the UI shows or hides; the backend checks again on every call
	});

module.exports = { me };
