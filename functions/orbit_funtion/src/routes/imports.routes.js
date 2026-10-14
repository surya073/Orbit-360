'use strict';

const c = require('../controllers/imports.controller');
const v = require('../validators/imports.validators');
const { parsePaging } = require('../utils/pagination');

// Import calls issue more Data Store requests than a normal call (bounded by the batch size),
// so they get a larger per-request budget.
const budget = 60;

module.exports = [
	{ method: 'GET', path: '/imports/templates', handler: c.templates },
	{ method: 'POST', path: '/imports/jobs', budget, validate: { body: v.createJobBody }, handler: c.createJob },
	{ method: 'GET', path: '/imports/jobs/:id', validate: { params: v.jobParams }, handler: c.getJob },
	{
		method: 'GET',
		path: '/imports/jobs/:id/rows',
		validate: { params: v.jobParams, query: (raw) => ({ ...v.rowsQuery(raw), paging: parsePaging(raw) }) },
		handler: c.listRows,
	},
	{ method: 'POST', path: '/imports/jobs/:id/preview', budget, validate: { params: v.jobParams, body: v.rowsBody }, handler: c.preview },
	{ method: 'POST', path: '/imports/jobs/:id/resolve', budget, validate: { params: v.jobParams, body: v.resolveBody }, handler: c.resolve },
	{ method: 'POST', path: '/imports/jobs/:id/commit', budget, validate: { params: v.jobParams, body: v.rowsBody }, handler: c.commit },
	{ method: 'POST', path: '/imports/jobs/:id/complete', budget, validate: { params: v.jobParams }, handler: c.complete },
	{ method: 'POST', path: '/imports/jobs/:id/cancel', validate: { params: v.jobParams }, handler: c.cancel },
];
