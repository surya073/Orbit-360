'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = crudRoutes('/employees', 'employees');
