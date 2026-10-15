'use strict';

const { errors } = require('../utils/errors');
const { businessNow } = require('../utils/dateUtils');
const { resources } = require('../config/resources');
const { audit } = require('./audit.service');
const { requirePermission } = require('../middleware/authorization');
const { KEY, moduleOfResource } = require('../config/permissions');
const { prepareRow, immutableFields, loadReferences, applyReferences } = require('./recordRules');

function resourceOf(name) {
	const r = Object.prototype.hasOwnProperty.call(resources, name) ? resources[name] : null;
	if (!r) throw errors.notFound('Unknown resource');
	return r;
}

/** The permission a resource action needs, e.g. ('attendance_records', 'edit') -> attendance.edit. Unmapped resources are denied. */
function need(ctx, name, action) {
	const module = moduleOfResource(name);
	if (!module) throw errors.forbidden('This operation is not available', 'NO_PERMISSION_DECLARED');
	requirePermission(ctx, KEY(module, action));
}

function writable(name, ctx, action) {
	const r = resourceOf(name);
	if (!r.fields) throw errors.notFound('Resource is read-only');
	need(ctx, name, action);
	return r;
}

const teamOf = (resource, row) => (resource.teamColumn && resource.teamColumn !== 'ROWID' ? row[resource.teamColumn] : resource.teamColumn === 'ROWID' ? row.ROWID : row.team_id) ?? null;

async function list(ctx, name, input) {
	const resource = resourceOf(name);
	need(ctx, name, 'view');
	const { scope } = ctx;
	// Tables with no team column (project_assignments) are scoped through their project.
	if (resource.scopeVia && !scope.isAdmin) {
		const fk = resource.scopeVia.fk;
		const id = input.filters[fk];
		if (!id) throw errors.badRequest(`${fk} filter is required`);
		const owners = await ctx.repos.table(resource.scopeVia.parent).ownersOf([id]);
		if (!owners.has(id)) throw errors.notFound('Referenced record does not exist');
		scope.assertTeam(owners.get(id));
	}
	return ctx.repos.table(name).list(scope, input);
}

async function get(ctx, name, id) {
	const resource = resourceOf(name);
	need(ctx, name, 'view');
	const row = await ctx.repos.table(name).findById(ctx.scope, id, { detail: true });
	if (!row) throw errors.notFound();
	return row;
}

async function create(ctx, name, value) {
	const resource = writable(name, ctx, 'create');
	const { scope } = ctx;
	const refs = await loadReferences(ctx, resource, [value]);
	const row = prepareRow(resource, applyReferences(scope, resource, { ...value }, refs));
	const inserted = await ctx.repos.table(name).insert(scope, row);
	await audit(ctx, { action: 'create', table: resource.table, rowId: inserted.ROWID, teamId: teamOf(resource, row), after: row });
	return { ...value, ROWID: String(inserted.ROWID) };
}

async function update(ctx, name, id, patch) {
	const resource = writable(name, ctx, 'edit');
	const { scope } = ctx;
	const repo = ctx.repos.table(name);
	const existing = await repo.findById(scope, id, { detail: true });
	if (!existing) throw errors.notFound();

	const errs = [...immutableFields(resource)].filter((k) => k in patch).map((field) => ({ field, code: 'IMMUTABLE', message: 'Cannot be changed after creation' }));
	if (errs.length) throw errors.validation(errs);
	if (!scope.isAdmin && resource.teamColumn && resource.teamColumn !== 'ROWID' && resource.teamColumn in patch && String(patch[resource.teamColumn]) !== scope.teamId) {
		throw errors.forbidden('Cannot move records to another team');
	}

	const merged = { ...existing, ...patch };
	const out = { ...patch };
	if (resource.derive) for (const [k, v] of Object.entries(resource.derive(merged))) if (v !== undefined) out[k] = v;
	if (resource.dedupe && !resource.randomDedupe) out.dedupe_key = prepareRow(resource, merged).dedupe_key;
	if (resource.table === 'time_entries') Object.assign(out, { approval_status: 'pending', approved_by_user_id: null, approved_at: null }); // edits must be re-approved
	await repo.update(scope, existing, out);
	await audit(ctx, { action: 'update', table: resource.table, rowId: existing.ROWID, teamId: teamOf(resource, existing), before: pick(existing, Object.keys(patch)), after: patch });
	return { ROWID: String(existing.ROWID), ...patch };
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

async function remove(ctx, name, id) {
	const resource = writable(name, ctx, 'delete');
	if (!resource.softDelete) throw errors.badRequest('This resource cannot be deleted');
	const repo = ctx.repos.table(name);
	const existing = await repo.findById(ctx.scope, id);
	if (!existing) throw errors.notFound();
	await repo.update(ctx.scope, existing, { is_deleted: 'true', deleted_at: businessNow(), deleted_by_user_id: ctx.actor.userId });
	await audit(ctx, { action: 'delete', table: resource.table, rowId: existing.ROWID, teamId: teamOf(resource, existing) });
	return { ROWID: String(existing.ROWID), deleted: true };
}

/** Approve/reject a time entry. Only approved entries feed billable metrics. */
async function decideTimeEntry(ctx, id, status) {
	requirePermission(ctx, 'time_entries.approve');
	const repo = ctx.repos.table('time_entries');
	const existing = await repo.findById(ctx.scope, id);
	if (!existing) throw errors.notFound();
	await repo.update(ctx.scope, existing, { approval_status: status, approved_by_user_id: ctx.actor.userId, approved_at: businessNow() });
	await audit(ctx, { action: 'update', table: 'time_entries', rowId: existing.ROWID, teamId: existing.team_id, before: { approval_status: existing.approval_status }, after: { approval_status: status } });
	return { ROWID: String(existing.ROWID), approval_status: status };
}

module.exports = { resourceOf, list, get, create, update, remove, decideTimeEntry };
