'use strict';

const { ok } = require('../utils/response');

/** The caller's verified identity, role and team, as the frontend should render them. */
const me = async ({ actor }) => ok({ userId: actor.userId, email: actor.email, displayName: actor.displayName, role: actor.role, teamId: actor.teamId });

module.exports = { me };
