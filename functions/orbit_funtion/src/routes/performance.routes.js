'use strict';

const { crudRoutes } = require('./crudRoutes');

// Read-only: scores need configured metric definitions/weights; no aggregate is invented here.
module.exports = [
	...crudRoutes('/performance', 'performance_records', { write: false }),
	...crudRoutes('/metric-definitions', 'metric_definitions', { write: false }),
];
