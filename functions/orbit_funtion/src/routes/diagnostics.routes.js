'use strict';

const c = require('../controllers/diagnostics.controller');

// One column lookup per table, so this route gets a larger Data Store budget than ordinary requests.
module.exports = [{ method: 'GET', path: '/diagnostics/schema', permission: 'access.manage_roles', budget: 40, handler: c.schema }];
