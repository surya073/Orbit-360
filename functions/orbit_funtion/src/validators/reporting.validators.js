'use strict';

const { errors } = require('../utils/errors');
const { isId } = require('./schema');

const MAX_NODES = 300;
const MAX_ROLE = 60;
const CTRL = /[\u0000-\u001f\u007f]/g;
const FOUR_BYTE = /[\u{10000}-\u{10FFFF}]/gu; // Data Store rejects 4-byte characters

const cleanRole = (v) => String(v).replace(FOUR_BYTE, '').replace(CTRL, ' ').replace(/\s+/g, ' ').trim();

/** First employee found on a reporting cycle, or null. `parentOf` is Map(id -> parentId|null). */
function findCycle(parentOf) {
	const state = new Map(); // 1 = visiting, 2 = done
	for (const start of parentOf.keys()) {
		const path = [];
		let cur = start;
		while (cur !== null && cur !== undefined && parentOf.has(cur) && state.get(cur) !== 2) {
			if (state.get(cur) === 1) return cur;
			state.set(cur, 1);
			path.push(cur);
			cur = parentOf.get(cur);
		}
		for (const p of path) state.set(p, 2);
	}
	return null;
}

function teamQuery(raw) {
	const t = raw && raw.team_id;
	if (t !== undefined && t !== '' && !isId(String(t))) throw errors.badRequest('team_id must be a numeric id');
	return { teamId: t === undefined || t === '' ? undefined : String(t) };
}

/** PUT body: { team_id?, nodes: [{ employeeId, parentId|null, roleLabel|null }] } = the complete desired tree. */
function structureBody(raw) {
	const errs = [];
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes)) throw errors.validation([{ field: 'nodes', code: 'INVALID_TYPE', message: 'nodes must be an array' }]);
	if (raw.team_id !== undefined && raw.team_id !== null && raw.team_id !== '' && !isId(String(raw.team_id))) errs.push({ field: 'team_id', code: 'INVALID_ID', message: 'team_id must be a numeric id' });
	if (raw.nodes.length > MAX_NODES) errs.push({ field: 'nodes', code: 'TOO_MANY', message: `At most ${MAX_NODES} employees per structure` });
	const nodes = [];
	const parentOf = new Map();
	raw.nodes.slice(0, MAX_NODES).forEach((n, i) => {
		const field = `nodes[${i}]`;
		if (!n || typeof n !== 'object' || !isId(String(n.employeeId || ''))) return errs.push({ field, code: 'INVALID_ID', message: 'employeeId must be a numeric id' });
		const employeeId = String(n.employeeId);
		const hasParent = n.parentId !== null && n.parentId !== undefined && n.parentId !== '';
		if (hasParent && !isId(String(n.parentId))) return errs.push({ field, code: 'INVALID_ID', message: 'parentId must be a numeric id' });
		const parentId = hasParent ? String(n.parentId) : null;
		if (parentOf.has(employeeId)) return errs.push({ field, code: 'DUPLICATE', message: 'This employee appears more than once in the structure' });
		if (parentId === employeeId) return errs.push({ field, code: 'SELF_REPORT', message: 'An employee cannot report to themselves' });
		let roleLabel = null;
		if (n.roleLabel !== null && n.roleLabel !== undefined && n.roleLabel !== '') {
			if (typeof n.roleLabel !== 'string') return errs.push({ field, code: 'INVALID_TYPE', message: 'roleLabel must be text' });
			roleLabel = cleanRole(n.roleLabel) || null;
			if (roleLabel && roleLabel.length > MAX_ROLE) return errs.push({ field, code: 'TOO_LONG', message: `Role label is limited to ${MAX_ROLE} characters` });
		}
		parentOf.set(employeeId, parentId);
		nodes.push({ employeeId, parentId, roleLabel });
	});
	for (const n of nodes) if (n.parentId && !parentOf.has(n.parentId)) errs.push({ field: 'nodes', code: 'MISSING_MANAGER', message: 'A manager is not part of the structure' });
	if (!errs.length) {
		const cyc = findCycle(parentOf);
		if (cyc) errs.push({ field: 'nodes', code: 'CIRCULAR', message: 'Circular reporting: an employee would end up reporting to themselves through a chain of managers' });
	}
	if (errs.length) throw errors.validation(errs);
	return { teamId: raw.team_id ? String(raw.team_id) : undefined, nodes };
}

module.exports = { structureBody, teamQuery, findCycle, MAX_NODES, MAX_ROLE };
