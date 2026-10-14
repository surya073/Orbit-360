'use strict';

const c = require('../controllers/dashboard.controller');
const { overviewQuery, trendsQuery, snapshotBody } = require('../validators/dashboard.validators');
const { idParams } = require('../validators/query.validators');
const { parsePaging } = require('../utils/pagination');

module.exports = [
	{ method: 'GET', path: '/dashboard/overview', validate: { query: overviewQuery }, handler: c.overview },
	{ method: 'GET', path: '/dashboard/trends', validate: { query: trendsQuery }, handler: c.trends },
	{ method: 'GET', path: '/dashboard/projects', validate: { query: overviewQuery }, handler: c.projects },
	{ method: 'GET', path: '/dashboard/product', validate: { query: overviewQuery }, handler: c.product },
	{ method: 'GET', path: '/dashboard/ai-usage', validate: { query: overviewQuery }, handler: c.aiUsage },
	{ method: 'GET', path: '/dashboard/freshness', validate: { query: overviewQuery }, handler: c.freshness },
	{ method: 'POST', path: '/dashboard/snapshots', validate: { body: snapshotBody }, handler: c.createSnapshot },
	{ method: 'GET', path: '/dashboard/snapshots', validate: { query: (raw) => ({ paging: parsePaging(raw) }) }, handler: c.listSnapshots },
	{ method: 'GET', path: '/dashboard/snapshots/:id', validate: { params: idParams }, handler: c.getSnapshot },
];
