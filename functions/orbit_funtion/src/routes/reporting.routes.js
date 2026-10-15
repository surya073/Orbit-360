'use strict';

const c = require('../controllers/reporting.controller');
const { structureBody, teamQuery } = require('../validators/reporting.validators');

module.exports = [
	{ method: 'GET', path: '/reporting-structure', validate: { query: teamQuery }, handler: c.get },
	{ method: 'PUT', path: '/reporting-structure', validate: { body: structureBody }, handler: c.save },
];
