'use strict';

const { errors } = require('../utils/errors');
const { audit } = require('./audit.service');

const KEY_PREFIX = 'orgtree.';

/** Stored value: {"p":"<managerId>"|null,"r":"role label"} ; {"x":1} marks an employee removed from the tree. */
const encode = (n) => JSON.stringify({ p: n.parentId, ...(n.roleLabel ? { r: n.roleLabel } : {}) });
const REMOVED = JSON.stringify({ x: 1 });

function decode(row) {
	try {
		const v = JSON.parse(row.setting_value);
		if (!v || v.x) return null;
		const employeeId = String(row.setting_key).slice(KEY_PREFIX.length);
		return { employeeId, parentId: v.p ? String(v.p) : null, roleLabel: v.r || null };
	} catch {
		return null; // unreadable value: treated as not placed
	}
}

function resolveTeam(ctx, requested) {
	const team = ctx.scope.resolveTeam(requested); // managers: pinned to their own team, others are 403
	if (!team) throw errors.badRequest('Choose a team: reporting structures are kept per team');
	return team;
}

const publicEmployee = (e, teamName) => ({
	id: String(e.ROWID),
	code: e.employee_code || null,
	name: e.full_name,
	email: e.email_normalized || null,
	jobRole: e.job_role || null,
	status: e.employment_status || null,
	department: teamName,
	sheetManagerId: e.reports_to_employee_id ? String(e.reports_to_employee_id) : null,
});

/** Saved tree + the team's real roster, in two reads plus the team name. Stale nodes (deleted/moved employees) are dropped. */
async function get(ctx, requestedTeam) {
	const teamId = resolveTeam(ctx, requestedTeam);
	const repo = ctx.repos.reporting;
	const team = await repo.team(ctx.scope, teamId);
	if (!team) throw errors.notFound('Team not found');
	const [roster, rows] = await Promise.all([repo.roster(ctx.scope, teamId), repo.nodes(ctx.scope, teamId)]);
	const ids = new Set(roster.map((e) => String(e.ROWID)));
	let nodes = rows.map(decode).filter((n) => n && ids.has(n.employeeId));
	const placed = new Set(nodes.map((n) => n.employeeId));
	// A manager that left the team/was deleted: the report becomes a top-level employee instead of dangling.
	nodes = nodes.map((n) => (n.parentId && !placed.has(n.parentId) ? { ...n, parentId: null } : n));
	return {
		team: { id: String(team.ROWID), name: team.name },
		employees: roster.map((e) => publicEmployee(e, team.name)),
		nodes,
		truncated: roster.length >= repo.ROSTER_MAX,
	};
}

async function save(ctx, input) {
	const teamId = resolveTeam(ctx, input.teamId);
	const repo = ctx.repos.reporting;
	const roster = await repo.roster(ctx.scope, teamId);
	const ids = new Set(roster.map((e) => String(e.ROWID)));
	const unknown = input.nodes.filter((n) => !ids.has(n.employeeId));
	if (unknown.length) throw errors.validation([{ field: 'nodes', code: 'NOT_FOUND', message: 'Some employees are not active members of this team' }]);

	const existing = await repo.nodes(ctx.scope, teamId);
	const byKey = new Map(existing.map((r) => [r.setting_key, r]));
	const desired = new Set(input.nodes.map((n) => `${KEY_PREFIX}${n.employeeId}`));
	const inserts = [];
	const updates = [];
	for (const n of input.nodes) {
		const key = `${KEY_PREFIX}${n.employeeId}`;
		const value = encode(n);
		const row = byKey.get(key);
		if (!row) inserts.push({ setting_key: key, scope: repo.SCOPE, team_id: teamId, setting_value: value, value_type: 'json', dedupe_key: `${repo.SCOPE}|${teamId}|${key}` });
		else if (row.setting_value !== value) updates.push({ ROWID: row.ROWID, setting_value: value });
	}
	for (const [key, row] of byKey) if (!desired.has(key) && row.setting_value !== REMOVED) updates.push({ ROWID: row.ROWID, setting_value: REMOVED });
	await repo.insertMany(inserts);
	await repo.updateMany(updates);
	if (inserts.length || updates.length) await audit(ctx, { action: 'update', table: 'application_settings', rowId: null, teamId, reason: `reporting structure: ${input.nodes.length} placed, ${inserts.length} added, ${updates.length} changed` });
	return { nodes: input.nodes, added: inserts.length, changed: updates.length };
}

module.exports = { get, save };
