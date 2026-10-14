'use strict';

const { errors } = require('../utils/errors');
const { isId, validateRecord } = require('./schema');
const { isValidDate } = require('../utils/dateUtils');
const { parsePaging } = require('../utils/pagination');
const { LIMITS } = require('../config/constants');

const SAFE_STR_RE = /^[A-Za-z0-9 _.\-/:@]{1,100}$/;

/** Normalises one filter value; anything outside the allowed shape is rejected, never escaped. */
function parseFilterValue(type, value, name) {
	switch (type) {
		case 'id':
			if (!isId(String(value))) throw errors.badRequest(`${name} must be a numeric id`);
			return String(value);
		case 'bool':
			if (value !== 'true' && value !== 'false') throw errors.badRequest(`${name} must be true or false`);
			return value;
		case 'date':
			if (!isValidDate(value)) throw errors.badRequest(`${name} must be YYYY-MM-DD`);
			return value;
		case 'str':
			if (typeof value !== 'string' || !SAFE_STR_RE.test(value)) throw errors.badRequest(`${name} has unsupported characters`);
			return value;
		default:
			throw new Error(`Unsupported filter type ${type}`);
	}
}

const present = (v) => v !== undefined && v !== '';

/** Validator for GET list endpoints, driven by the resource definition. */
function listQuery(resource) {
	return (raw) => {
		const paging = parsePaging(raw);
		const out = { paging, filters: {} };

		if (present(raw.team_id)) out.team_id = parseFilterValue('id', raw.team_id, 'team_id');
		if (present(raw.ids)) {
			const ids = String(raw.ids).split(',');
			if (ids.length > LIMITS.maxIdsLookup || !ids.every(isId)) throw errors.badRequest(`ids must be up to ${LIMITS.maxIdsLookup} comma-separated numeric ids`);
			out.ids = ids;
		}
		for (const [name, type] of Object.entries(resource.filters || {})) {
			if (present(raw[name])) out.filters[name] = parseFilterValue(type, raw[name], name);
		}
		if (resource.dateColumn) {
			if (present(raw.from)) out.from = parseFilterValue('date', raw.from, 'from');
			if (present(raw.to)) out.to = parseFilterValue('date', raw.to, 'to');
			if (out.from && out.to && out.to < out.from) throw errors.badRequest('to must not be before from');
		}
		if (resource.search && present(raw.q)) {
			const q = String(raw.q).replace(/[^A-Za-z0-9 _.\-@]/g, '').trim().slice(0, 60);
			if (q) out.q = q;
		}
		if (present(raw.sort)) {
			if (!(resource.sortable || []).includes(raw.sort)) throw errors.badRequest('sort column is not allowed');
			out.sort = raw.sort;
		}
		if (present(raw.dir)) {
			if (raw.dir !== 'asc' && raw.dir !== 'desc') throw errors.badRequest('dir must be asc or desc');
			out.dir = raw.dir;
		}
		return out;
	};
}

const idParams = (raw) => {
	if (!isId(String(raw.id))) throw errors.badRequest('Invalid id');
	return { ...raw, id: String(raw.id) };
};

/** Body validator for create/update against a resource's writable fields. */
function crudBody(resource, { partial = false } = {}) {
	return (body) => {
		const { value, errors: errs } = validateRecord(resource.fields, body, { partial });
		for (const rule of resource.crossFieldRules || []) {
			const e = rule(value);
			if (e) errs.push(e);
		}
		if (errs.length) throw errors.validation(errs);
		if (partial && Object.keys(value).length === 0) throw errors.badRequest('No fields to update');
		return value;
	};
}

module.exports = { parseFilterValue, listQuery, idParams, crudBody, SAFE_STR_RE };
