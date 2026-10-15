'use strict';

const { ok } = require('../utils/response');
const { me } = require('../controllers/session.controller');

// Public liveness probe: reveals nothing about data or configuration.
const health = async () => ok({ service: 'company360-api', status: 'up' });

module.exports = [
	{ method: 'GET', path: '/health', public: true, handler: health },
	{ method: 'GET', path: '/me', open: true, handler: me }, // any provisioned user may ask who they are
];
