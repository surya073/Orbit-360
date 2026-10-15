'use strict';

const c = require('../controllers/imports.controller');
const v = require('../validators/imports.validators');
const { parsePaging } = require('../utils/pagination');

// Import calls issue more Data Store requests than a normal call (bounded by the batch size),
// so they get a larger per-request budget.
const budget = 60;

module.exports = [
	// Field contracts only (no data): every provisioned user needs them to render the Add/Edit forms.
	{ method: 'GET', path: '/imports/templates', open: true, handler: c.templates },
	{ method: 'POST', path: '/imports/jobs', permission: 'imports.create', budget, validate: { body: v.createJobBody }, handler: c.createJob },
	{ method: 'GET', path: '/imports/jobs/:id', permission: 'imports.view', validate: { params: v.jobParams }, handler: c.getJob },
	{
		method: 'GET',
		path: '/imports/jobs/:id/rows',
		permission: 'imports.view',
		validate: { params: v.jobParams, query: (raw) => ({ ...v.rowsQuery(raw), paging: parsePaging(raw) }) },
		handler: c.listRows,
	},
	{ method: 'POST', path: '/imports/jobs/:id/preview', permission: 'imports.create', budget, validate: { params: v.jobParams, body: v.rowsBody }, handler: c.preview },
	{ method: 'POST', path: '/imports/jobs/:id/resolve', permission: 'imports.create', budget, validate: { params: v.jobParams, body: v.resolveBody }, handler: c.resolve },
	{ method: 'POST', path: '/imports/jobs/:id/commit', permission: 'imports.create', budget, validate: { params: v.jobParams, body: v.rowsBody }, handler: c.commit },
	{ method: 'POST', path: '/imports/jobs/:id/complete', permission: 'imports.create', budget, validate: { params: v.jobParams }, handler: c.complete },
	{ method: 'POST', path: '/imports/jobs/:id/cancel', permission: 'imports.create', validate: { params: v.jobParams }, handler: c.cancel },
];
