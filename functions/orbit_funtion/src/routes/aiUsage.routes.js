'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = crudRoutes('/ai-usage', 'ai_usage_records');
