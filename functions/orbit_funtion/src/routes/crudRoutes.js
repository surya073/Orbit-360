'use strict';

const { crudController } = require('../controllers/crud.controller');
const { resources } = require('../config/resources');
const { listQuery, idParams, crudBody } = require('../validators/query.validators');
const { moduleOfResource, KEY } = require('../config/permissions');

/**
 * Route definitions for one resource. `write: false` yields read-only routes. Each route declares the
 * permission it needs (<module>.view / create / edit / delete); the services check it again, and team
 * rules are enforced in services/repositories, so a route can never accidentally bypass them.
 */
function crudRoutes(basePath, resourceName, { write = true } = {}) {
	const resource = resources[resourceName];
	const c = crudController(resourceName);
	const module = moduleOfResource(resourceName);
	if (!module) throw new Error(`No permission module for resource ${resourceName}`);
	const routes = [
		{ method: 'GET', path: basePath, permission: KEY(module, 'view'), validate: { query: listQuery(resource) }, handler: c.list },
		{ method: 'GET', path: `${basePath}/:id`, permission: KEY(module, 'view'), validate: { params: idParams }, handler: c.get },
	];
	if (write && resource.fields) {
		routes.push(
			{ method: 'POST', path: basePath, permission: KEY(module, 'create'), validate: { body: crudBody(resource) }, handler: c.create },
			{ method: 'PATCH', path: `${basePath}/:id`, permission: KEY(module, 'edit'), validate: { params: idParams, body: crudBody(resource, { partial: true }) }, handler: c.update }
		);
		if (resource.softDelete) routes.push({ method: 'DELETE', path: `${basePath}/:id`, permission: KEY(module, 'delete'), validate: { params: idParams }, handler: c.remove });
	}
	return routes;
}

module.exports = { crudRoutes };
