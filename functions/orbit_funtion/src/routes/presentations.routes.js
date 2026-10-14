'use strict';

const c = require('../controllers/presentations.controller');
const { idParams } = require('../validators/query.validators');
const { presentationBody } = require('../validators/presentations.validators');
const { parsePaging } = require('../utils/pagination');

module.exports = [
	{ method: 'GET', path: '/presentations', validate: { query: (raw) => ({ paging: parsePaging(raw) }) }, handler: c.list },
	{ method: 'POST', path: '/presentations', validate: { body: presentationBody() }, handler: c.create },
	{ method: 'GET', path: '/presentations/:id', validate: { params: idParams }, handler: c.get },
	{ method: 'PATCH', path: '/presentations/:id', validate: { params: idParams, body: presentationBody({ partial: true }) }, handler: c.update },
	{ method: 'DELETE', path: '/presentations/:id', validate: { params: idParams }, handler: c.remove },
	{ method: 'POST', path: '/presentations/:id/presented', validate: { params: idParams }, handler: c.markPresented },
];
