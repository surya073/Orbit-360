'use strict';

const { errors } = require('../utils/errors');
const { isId } = require('./schema');
const { isPermissionKey, SCOPE_TYPES, ALL_KEYS } = require('../config/permissions');
const { parsePaging } = require('../utils/pagination');

const bad = (field, message, code = 'INVALID_VALUE') => errors.validation([{ field, code, message }]);
const present = (v) => v !== undefined && v !== null && v !== '';
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} &()_.,'-]{1,59}$/u;
const REF_RE = /^(\d{1,20}|admin|manager)$/;

/** :ref is a numeric role id or a built-in role key. */
function refParams(raw) {
	const ref = String(raw.ref || '');
	if (!REF_RE.test(ref)) throw errors.badRequest('Invalid role reference');
	return { ref };
}

const text = (v, field, { min = 0, max, required = false, re }) => {
	if (!present(v)) {
		if (required) throw bad(field, 'Required', 'REQUIRED');
		return undefined;
	}
	if (typeof v !== 'string') throw bad(field, 'Must be text');
	const s = v.replace(/\s+/g, ' ').trim();
	if (s.length < min) throw bad(field, `Must be at least ${min} characters`);
	if (s.length > max) throw bad(field, `Must be at most ${max} characters`);
	if (re && !re.test(s)) throw bad(field, 'Use letters, numbers and simple punctuation only');
	return s;
};

function permissionList(v, field = 'permissions') {
	if (!Array.isArray(v)) throw bad(field, 'Must be a list of permissions', 'REQUIRED');
	if (v.length > ALL_KEYS.length) throw bad(field, 'Too many permissions');
	const keys = [...new Set(v.map(String))];
	const unknown = keys.filter((k) => !isPermissionKey(k));
	if (unknown.length) throw bad(field, `Unknown permission: ${unknown[0]}`);
	return keys;
}

function createRoleBody(raw = {}) {
	const scopeType = raw.scopeType;
	if (scopeType !== SCOPE_TYPES.ALL_TEAMS && scopeType !== SCOPE_TYPES.OWN_TEAM) throw bad('scopeType', 'Choose which teams this role covers');
	return {
		name: text(raw.name, 'name', { min: 2, max: 60, required: true, re: NAME_RE }),
		description: text(raw.description, 'description', { max: 255 }),
		scopeType,
		permissions: raw.permissions === undefined ? [] : permissionList(raw.permissions),
	};
}

function updateRoleBody(raw = {}) {
	const out = {};
	if (raw.name !== undefined) out.name = text(raw.name, 'name', { min: 2, max: 60, required: true, re: NAME_RE });
	if (raw.description !== undefined) out.description = text(raw.description, 'description', { max: 255 }) || '';
	if (raw.isActive !== undefined) {
		if (typeof raw.isActive !== 'boolean') throw bad('isActive', 'Must be true or false');
		out.isActive = raw.isActive;
	}
	if (Object.keys(out).length === 0) throw errors.badRequest('Nothing to update');
	return out;
}

const permissionsBody = (raw = {}) => ({ permissions: permissionList(raw.permissions) });

function updateUserBody(raw = {}) {
	const out = {};
	if (raw.roleId !== undefined) {
		const ref = String(raw.roleId);
		if (!REF_RE.test(ref)) throw bad('roleId', 'Choose a role');
		out.roleId = ref;
	}
	if (raw.teamId !== undefined) {
		if (!isId(String(raw.teamId))) throw bad('teamId', 'Choose a team');
		out.teamId = String(raw.teamId);
	}
	if (raw.isActive !== undefined) {
		if (typeof raw.isActive !== 'boolean') throw bad('isActive', 'Must be true or false');
		out.isActive = raw.isActive;
	}
	if (Object.keys(out).length === 0) throw errors.badRequest('Nothing to update');
	return out;
}

function usersQuery(raw = {}) {
	const q = present(raw.q) ? String(raw.q).replace(/[^A-Za-z0-9 _.\-@]/g, '').trim().slice(0, 60) : '';
	if (present(raw.team_id) && !isId(String(raw.team_id))) throw errors.badRequest('team_id must be a numeric id');
	return { q: q || undefined, teamId: present(raw.team_id) ? String(raw.team_id) : undefined, paging: parsePaging(raw, { maxPageSize: 50, defaultPageSize: 20 }) };
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const PERSON_RE = /^[\p{L}][\p{L} .'-]{0,49}$/u;

/** First and last name, email, the role (chosen before inviting) and, for team roles, the team. */
function inviteBody(raw = {}) {
	const email = text(raw.email, 'email', { required: true, max: 120 });
	if (!EMAIL_RE.test(email)) throw bad('email', 'Enter a valid email address');
	const ref = String(raw.roleId ?? '');
	if (!REF_RE.test(ref)) throw bad('roleId', 'Choose a role');
	const out = {
		firstName: text(raw.firstName, 'firstName', { required: true, max: 50, re: PERSON_RE }),
		lastName: text(raw.lastName, 'lastName', { required: true, max: 50, re: PERSON_RE }),
		email: email.toLowerCase(),
		roleId: ref,
	};
	if (present(raw.teamId)) {
		if (!isId(String(raw.teamId))) throw bad('teamId', 'Choose a team');
		out.teamId = String(raw.teamId);
	}
	return out;
}

/** What one person may additionally do (allow) or may not do (deny), on top of their role. Empty lists clear the overrides. */
function userPermissionsBody(raw = {}) {
	const allow = raw.allow === undefined ? [] : permissionList(raw.allow, 'allow');
	const deny = raw.deny === undefined ? [] : permissionList(raw.deny, 'deny');
	const both = allow.find((k) => deny.includes(k));
	if (both) throw bad('deny', `${both} cannot be both allowed and denied`);
	return { allow, deny };
}

module.exports = { inviteBody, userPermissionsBody, refParams, createRoleBody, updateRoleBody, permissionsBody, updateUserBody, usersQuery };
