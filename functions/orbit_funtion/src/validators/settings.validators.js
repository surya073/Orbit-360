'use strict';

const { errors } = require('../utils/errors');
const { f, validateRecord } = require('./schema');

const FIELDS = {
	setting_key: f.str(100, { req: true }),
	scope: f.oneOf(['global', 'team'], { req: true }),
	team_id: f.id(),
	setting_value: f.text(2000),
	value_type: f.oneOf(['string', 'number', 'boolean', 'json']),
	description: f.text(500),
};
const KEY_RE = /^[a-z0-9_.]{1,100}$/;

function settingBody(raw) {
	const { value, errors: errs } = validateRecord(FIELDS, raw);
	if (value.setting_key && !KEY_RE.test(value.setting_key)) errs.push({ field: 'setting_key', code: 'INVALID_VALUE', message: 'Use lowercase letters, digits, "." and "_"' });
	if (value.scope === 'team' && !value.team_id) errs.push({ field: 'team_id', code: 'REQUIRED', message: 'Required for team scope' });
	if (value.scope === 'global' && value.team_id) errs.push({ field: 'team_id', code: 'INVALID_VALUE', message: 'Not allowed for global scope' });
	if (errs.length) throw errors.validation(errs);
	return value;
}

module.exports = { settingBody };
