'use strict';

const { errors } = require('../utils/errors');
const { ROLES } = require('../config/constants');
const { isId } = require('../validators/schema');

/**
 * The single place team scoping is decided. Controllers obtain a Scope via requireScope();
 * repositories REQUIRE one (assertScope) so a query can never run unscoped by accident.
 *
 * Admin   : unrestricted (optionally narrowed by a requested team filter).
 * Manager : always pinned to the one team stored in their `users` row.
 */
class Scope {
	constructor(actor) {
		this.actor = actor;
		this.isAdmin = actor.role === ROLES.ADMIN;
		this.teamId = this.isAdmin ? null : String(actor.teamId);
		Object.freeze(this);
	}

	/** Effective team filter for a request. Managers cannot widen or change it. */
	resolveTeam(requested) {
		if (requested !== undefined && requested !== null && requested !== '' && !isId(String(requested))) {
			throw errors.badRequest('team_id must be a numeric id');
		}
		const has = requested !== undefined && requested !== null && requested !== '';
		if (!this.isAdmin) {
			if (has && String(requested) !== this.teamId) throw errors.forbidden('You can only access your own team');
			return this.teamId;
		}
		return has ? String(requested) : null;
	}

	/** SQL condition restricting `column` to the manager's team; null for admins. */
	condition(column) {
		return this.isAdmin ? null : `${column} = ${this.teamId}`;
	}

	/** Throws unless the actor may touch rows owned by `teamId` (null = team-less, admin only). */
	assertTeam(teamId) {
		if (this.isAdmin) return;
		if (teamId === null || teamId === undefined || String(teamId) !== this.teamId) {
			throw errors.forbidden('This record belongs to another team');
		}
	}

	canAccessTeam(teamId) {
		return this.isAdmin || (teamId !== null && teamId !== undefined && String(teamId) === this.teamId);
	}
}

function requireScope(actor) {
	if (!actor || (actor.role !== ROLES.ADMIN && actor.role !== ROLES.MANAGER)) throw errors.forbidden('Your account has no valid role', 'INVALID_ROLE');
	if (actor.role === ROLES.MANAGER && !isId(String(actor.teamId || ''))) {
		throw errors.forbidden('Your manager account is not assigned to a team', 'MANAGER_TEAM_MISSING');
	}
	return new Scope(actor);
}

/** Guard used by repositories: programming errors must fail loudly, never run unscoped. */
function assertScope(scope) {
	if (!(scope instanceof Scope)) throw new Error('A Scope from requireScope() is required for this operation');
	return scope;
}

module.exports = { Scope, requireScope, assertScope };
