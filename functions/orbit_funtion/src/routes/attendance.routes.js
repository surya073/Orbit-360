'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = crudRoutes('/attendance', 'attendance_records');
