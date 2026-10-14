'use strict';

const { crudController } = require('../controllers/crud.controller');
const { resources } = require('../config/resources');
const { listQuery, idParams, crudBody } = require('../validators/query.validators');

/**
 * Route definitions for one resource. `write: false` yields read-only routes.
 * Role and team rules are enforced in services/repositories, not here, so a route
 * can never accidentally bypass them.
 */
function crudRoutes(basePath, resourceName, { write = true } = {}) {
	const resource = resources[resourceName];
	const c = crudController(resourceName);
	const routes = [
		{ method: 'GET', path: basePath, validate: { query: listQuery(resource) }, handler: c.list },
		{ method: 'GET', path: `${basePath}/:id`, validate: { params: idParams }, handler: c.get },
	];
	if (write && resource.fields) {
		routes.push(
			{ method: 'POST', path: basePath, validate: { body: crudBody(resource) }, handler: c.create },
			{ method: 'PATCH', path: `${basePath}/:id`, validate: { params: idParams, body: crudBody(resource, { partial: true }) }, handler: c.update }
		);
		if (resource.softDelete) routes.push({ method: 'DELETE', path: `${basePath}/:id`, validate: { params: idParams }, handler: c.remove });
	}
	return routes;
}

module.exports = { crudRoutes };
