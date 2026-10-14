'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = crudRoutes('/leave', 'leave_records');
