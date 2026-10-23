'use strict';

const zlib = require('zlib');
const { errors } = require('../utils/errors');
const { businessNow } = require('../utils/dateUtils');
const { LIMITS } = require('../config/constants');
const { audit } = require('./audit.service');

/**
 * Storage format (saved_presentations.slides_config, text):
 *   v2: { v: 2, period: { preset, from?, to? }, filters: { teamId, projectId }, slides: [...] } as JSON, or, when that is
 *       too long for the column, as "z1:" + base64(deflate(JSON)). Free-form studio slides are text and shapes, so a
 *       whole deck compresses to a fraction of its size; the 9,000-character limit applies to what is stored.
 *   v1 (legacy): a bare array of slides.
 * Section slides hold no data: they are rendered live for the saved period/filters, and every
 * data request is authorized by the backend for the viewer (a manager can never see another team).
 */
const MAX_RAW = 200 * 1024; // before compression: a sanity cap, the real limit is the stored size
const tooLarge = () => errors.validation([{ field: 'slides', code: 'TOO_LARGE', message: 'This presentation is too large to save. Remove some slides, images or text.' }]);

const pack = (cfg) => {
	const json = JSON.stringify({ v: 2, ...cfg });
	if (json.length <= LIMITS.maxTextConfig) return json;
	if (json.length > MAX_RAW) throw tooLarge();
	const packed = `z1:${zlib.deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 }).toString('base64')}`;
	if (packed.length > LIMITS.maxTextConfig) throw tooLarge();
	return packed;
};

function unpack(text) {
	if (!text) return { v: 2, period: { preset: 'this_month' }, filters: {}, slides: [] };
	const raw = text.startsWith('z1:') ? zlib.inflateRawSync(Buffer.from(text.slice(3), 'base64'), { maxOutputLength: MAX_RAW * 2 }).toString('utf8') : text;
	const parsed = JSON.parse(raw);
	if (Array.isArray(parsed)) return { v: 1, period: { preset: 'this_month' }, filters: {}, slides: parsed };
	return parsed;
}

const COVER_OBJECTS = 10;

/** What a card in the list needs to look like the deck: how many slides, whether it is a studio deck, and a trimmed first slide. */
function summarize(row) {
	const { slides_config, ...rest } = row;
	try {
		const slides = unpack(slides_config).slides || [];
		const first = slides.find((s) => s && s.type === 'custom');
		return { ...rest, slideCount: slides.length, studio: Boolean(first), cover: first ? { type: 'custom', bg: first.bg, objects: (first.objects || []).slice(0, COVER_OBJECTS) } : null };
	} catch {
		return { ...rest, slideCount: null, studio: false, cover: null, unreadable: true };
	}
}

async function list(ctx, paging) {
	const r = await ctx.repos.presentations.list(ctx.scope, paging);
	return { ...r, rows: r.rows.map(summarize) };
}

async function get(ctx, id) {
	const row = await ctx.repos.presentations.findById(ctx.scope, id, { withSlides: true });
	if (!row) throw errors.notFound();
	let config = null;
	let slidesProblem = null;
	try {
		config = unpack(row.slides_config);
	} catch (err) {
		slidesProblem = err && err.code === 'Z_DATA_ERROR' ? 'The saved slides are damaged.' : 'The saved slides could not be decoded.'; // reported as unavailable, never with the content
	}
	const { slides_config, is_deleted, ...rest } = row;
	return { ...rest, config, slides: config ? config.slides : null, slidesAvailable: config !== null, ...(slidesProblem ? { slidesProblem } : {}) };
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
