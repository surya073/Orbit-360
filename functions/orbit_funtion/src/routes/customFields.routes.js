'use strict';

const { crudRoutes } = require('./crudRoutes');

// Definitions of extra columns. Reading is open to every role with custom_fields.view; changing them is an
// administrator permission (custom_fields.create / edit / delete).
module.exports = crudRoutes('/custom-fields', 'custom_fields');
