'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = [...crudRoutes('/projects', 'projects'), ...crudRoutes('/project-assignments', 'project_assignments')];
