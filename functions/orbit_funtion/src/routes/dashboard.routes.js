'use strict';

const c = require('../controllers/dashboard.controller');
const { overviewQuery, trendsQuery, bundleQuery, snapshotBody, peopleProfilesQuery } = require('../validators/dashboard.validators');
const { idParams } = require('../validators/query.validators');
const { parsePaging } = require('../utils/pagination');

module.exports = [
	// The whole dashboard in one request: six sections, each succeeding or failing on its own. Own budget: it runs six services.
	{ method: 'GET', path: '/dashboard/bundle', permission: 'dashboard.view', validate: { query: bundleQuery }, budget: 40, handler: c.bundle },
	{ method: 'GET', path: '/dashboard/overview', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.overview },
	{ method: 'GET', path: '/dashboard/trends', permission: 'dashboard.view', validate: { query: trendsQuery }, handler: c.trends },
	{ method: 'GET', path: '/dashboard/projects', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.projects },
	{ method: 'GET', path: '/dashboard/product', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.product },
	{ method: 'GET', path: '/dashboard/ai-usage', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.aiUsage },
	{ method: 'GET', path: '/dashboard/freshness', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.freshness },
	{ method: 'GET', path: '/dashboard/highlights', permission: 'dashboard.view', validate: { query: overviewQuery }, handler: c.highlights },
	{ method: 'GET', path: '/dashboard/people-profiles', permission: ['dashboard.view', 'employees.view'], validate: { query: peopleProfilesQuery }, handler: c.peopleProfiles },
	{ method: 'POST', path: '/dashboard/snapshots', permission: 'dashboard.export', validate: { body: snapshotBody }, handler: c.createSnapshot },
	{ method: 'GET', path: '/dashboard/snapshots', permission: 'dashboard.view', validate: { query: (raw) => ({ paging: parsePaging(raw) }) }, handler: c.listSnapshots },
	{ method: 'GET', path: '/dashboard/snapshots/:id', permission: 'dashboard.view', validate: { params: idParams }, handler: c.getSnapshot },
];
