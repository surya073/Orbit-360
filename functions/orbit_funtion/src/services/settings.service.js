'use strict';

const { requireRole } = require('../middleware/authorization');
const { ROLES } = require('../config/constants');
const { audit } = require('./audit.service');

const list = (ctx) => ctx.repos.settings.list(ctx.scope);

/** Admin-only upsert, keyed by scope|team|key (the table's unique dedupe_key). */
async function upsert(ctx, value) {
	requireRole(ctx, [ROLES.ADMIN]);
	const dedupe = `${value.scope}|${value.team_id || ''}|${value.setting_key}`;
	const existing = await ctx.repos.settings.findByKey(dedupe);
	const row = { ...value, dedupe_key: dedupe };
	const rowId = existing ? existing.ROWID : (await ctx.repos.settings.insert(row)).ROWID;
	if (existing) await ctx.repos.settings.update({ ...row, ROWID: rowId });
	await audit(ctx, { action: existing ? 'update' : 'create', table: 'application_settings', rowId, teamId: value.team_id, after: value });
	return { ROWID: String(rowId) };
}

module.exports = { list, upsert };
