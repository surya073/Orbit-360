'use strict';

const c = require('../controllers/access.controller');
const v = require('../validators/access.validators');
const { idParams } = require('../validators/query.validators');

// Listing roles reads each role's permissions (one query per role), so it gets a larger budget.
const budget = 60;

module.exports = [
	{ method: 'GET', path: '/access/catalog', permission: 'access.view', handler: c.catalog },
	{ method: 'GET', path: '/access/roles', permission: 'access.view', budget, handler: c.listRoles },
	{ method: 'POST', path: '/access/roles', permission: 'access.manage_roles', budget, validate: { body: v.createRoleBody }, handler: c.createRole },
	{ method: 'PATCH', path: '/access/roles/:ref', permission: 'access.manage_roles', budget, validate: { params: v.refParams, body: v.updateRoleBody }, handler: c.updateRole },
	{ method: 'PUT', path: '/access/roles/:ref/permissions', permission: 'access.manage_roles', budget, validate: { params: v.refParams, body: v.permissionsBody }, handler: c.setPermissions },
	{ method: 'GET', path: '/access/users', permission: 'access.view', budget, validate: { query: v.usersQuery }, handler: c.listUsers },
	{ method: 'POST', path: '/access/invitations', permission: 'access.manage_users', budget, validate: { body: v.inviteBody }, handler: c.inviteUser },
	{ method: 'GET', path: '/access/users/:id/permissions', permission: 'access.view', budget, validate: { params: idParams }, handler: c.getUserAccess },
	{ method: 'PUT', path: '/access/users/:id/permissions', permission: 'access.manage_users', budget, validate: { params: idParams, body: v.userPermissionsBody }, handler: c.setUserPermissions },
	{ method: 'PATCH', path: '/access/users/:id', permission: 'access.manage_users', budget, validate: { params: idParams, body: v.updateUserBody }, handler: c.updateUser },
];
