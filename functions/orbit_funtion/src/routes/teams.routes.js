'use strict';

const { crudRoutes } = require('./crudRoutes');

// Managers read their own team; only admins create/update teams (enforced in crud.service).
module.exports = crudRoutes('/teams', 'teams');
