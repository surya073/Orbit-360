'use strict';

const { errors } = require('../utils/errors');
const { businessNow } = require('../utils/dateUtils');
const { LIMITS } = require('../config/constants');
const { audit } = require('./audit.service');

/**
 * Storage format (saved_presentations.slides_config, JSON text):
 *   v2: { v: 2, period: { preset, from?, to? }, filters: { teamId, projectId }, slides: [...] }
 *   v1 (legacy): a bare array of slides.
 * Section slides hold no data: they are rendered live for the saved period/filters, and every
 * data request is authorized by the backend for the viewer (a manager can never see another team).
 */
const pack = (cfg) => {
	const json = JSON.stringify({ v: 2, ...cfg });
	if (json.length > LIMITS.maxTextConfig) throw errors.validation([{ field: 'slides', code: 'TOO_LARGE', message: 'Presentation is too large' }]);
	return json;
};

function unpack(text) {
	if (!text) return { v: 2, period: { preset: 'this_month' }, filters: {}, slides: [] };
	const parsed = JSON.parse(text);
	if (Array.isArray(parsed)) return { v: 1, period: { preset: 'this_month' }, filters: {}, slides: parsed };
	return parsed;
}

async function list(ctx, paging) {
	return ctx.repos.presentations.list(ctx.scope, paging);
}

async function get(ctx, id) {
	const row = await ctx.repos.presentations.findById(ctx.scope, id, { withSlides: true });
	if (!row) throw errors.notFound();
	let config = null;
	try {
		config = unpack(row.slides_config);
	} catch {
		/* reported as unavailable */
	}
	const { slides_config, is_deleted, ...rest } = row;
	return { ...rest, config, slides: config ? config.slides : null, slidesAvailable: config !== null };
}

/** A project filter must exist and, for managers, belong to their team. */
async function checkProject(ctx, projectId) {
	if (!projectId) return;
	const owners = await ctx.repos.table('projects').ownersOf([projectId]);
	if (!owners.has(projectId)) throw errors.validation([{ field: 'filters', code: 'NOT_FOUND', message: 'Project does not exist' }]);
	ctx.scope.assertTeam(owners.get(projectId));
}

async function create(ctx, input) {
	const { scope } = ctx;
	// Managers are pinned to their team; only admins may create cross-team (team-less) decks.
	const team = scope.isAdmin ? input.team_id || null : scope.teamId;
	await checkProject(ctx, input.projectId);
	const row = await ctx.repos.presentations.insert(scope, {
		title: input.title,
		...(team ? { team_id: team } : {}),
		created_by_user_id: ctx.actor.userId,
		slides_config: pack({ period: input.period, filters: { teamId: team, projectId: input.projectId || null }, slides: input.slides }),
		status: input.status || 'draft',
		is_deleted: 'false',
	});
	await audit(ctx, { action: 'create', table: 'saved_presentations', rowId: row.ROWID, teamId: team });
	return { ROWID: String(row.ROWID) };
}

async function update(ctx, id, input) {
	const { scope } = ctx;
	const existing = await ctx.repos.presentations.findById(scope, id, { withSlides: true });
	if (!existing) throw errors.notFound();
	const patch = {};
	if (input.title) patch.title = input.title;
	if (input.status) patch.status = input.status;
	if (input.team_id !== undefined) {
		if (!scope.isAdmin) throw errors.forbidden('Only administrators can change a presentation team');
		patch.team_id = input.team_id;
	}
	if (input.slides !== undefined || input.period !== undefined || input.projectId !== undefined || patch.team_id !== undefined) {
		let current;
		try {
			current = unpack(existing.slides_config);
		} catch {
			current = { period: { preset: 'this_month' }, filters: {}, slides: [] };
		}
		const team = patch.team_id !== undefined ? patch.team_id : existing.team_id || null;
		const projectId = input.projectId !== undefined ? input.projectId : (current.filters && current.filters.projectId) || null;
		await checkProject(ctx, projectId);
		patch.slides_config = pack({ period: input.period || current.period, filters: { teamId: team, projectId }, slides: input.slides !== undefined ? input.slides : current.slides });
	}
	await ctx.repos.presentations.update(scope, existing, patch);
	await audit(ctx, { action: 'update', table: 'saved_presentations', rowId: existing.ROWID, teamId: existing.team_id });
	return { ROWID: String(existing.ROWID) };
}

async function markPresented(ctx, id) {
	const existing = await ctx.repos.presentations.findById(ctx.scope, id);
	if (!existing) throw errors.notFound();
	await ctx.repos.presentations.update(ctx.scope, existing, { last_presented_at: businessNow() });
	return { ROWID: String(existing.ROWID) };
}

async function remove(ctx, id) {
	const existing = await ctx.repos.presentations.findById(ctx.scope, id);
	if (!existing) throw errors.notFound();
	await ctx.repos.presentations.update(ctx.scope, existing, { is_deleted: 'true', deleted_at: businessNow(), deleted_by_user_id: ctx.actor.userId });
	await audit(ctx, { action: 'delete', table: 'saved_presentations', rowId: existing.ROWID, teamId: existing.team_id });
	return { ROWID: String(existing.ROWID), deleted: true };
}

module.exports = { list, get, create, update, markPresented, remove, unpack };
