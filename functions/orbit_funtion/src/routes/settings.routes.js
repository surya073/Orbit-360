'use strict';

const c = require('../controllers/settings.controller');
const { settingBody } = require('../validators/settings.validators');

module.exports = [
	{ method: 'GET', path: '/settings', handler: c.list },
	{ method: 'PUT', path: '/settings', roles: ['admin'], validate: { body: settingBody }, handler: c.upsert },
];
