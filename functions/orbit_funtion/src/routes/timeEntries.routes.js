'use strict';

const { ok } = require('../utils/response');
const { crudRoutes } = require('./crudRoutes');
const { idParams } = require('../validators/query.validators');
const { errors } = require('../utils/errors');
const crud = require('../services/crud.service');

const decisionBody = (raw) => {
	if (raw.status !== 'approved' && raw.status !== 'rejected') {
		throw errors.validation([{ field: 'status', code: 'INVALID_VALUE', message: 'Must be approved or rejected' }]);
	}
	return { status: raw.status };
};

module.exports = [
	...crudRoutes('/time-entries', 'time_entries'),
	{
		method: 'POST',
		path: '/time-entries/:id/decision',
		validate: { params: idParams, body: decisionBody },
		handler: async (ctx) => ok(await crud.decideTimeEntry(ctx, ctx.input.params.id, ctx.input.body.status)),
	},
];
