'use strict';

const { resources } = require('../config/resources');
const { createTableRepository } = require('./base.repository');
const { createUserRepository } = require('./user.repository');
const { createAuditRepository } = require('./audit.repository');
const { createDashboardRepository } = require('./dashboard.repository');
const { createSnapshotRepository } = require('./snapshot.repository');
const { createImportRepository } = require('./import.repository');
const { createPresentationRepository } = require('./presentation.repository');
const { createSettingsRepository } = require('./settings.repository');

/** One set of repositories per request, all sharing the request's budgeted `db`. */
function createRepositories(db) {
	const tables = {};
	return {
		table(name) {
			if (!resources[name]) throw new Error(`Unknown resource ${name}`);
			return (tables[name] ||= createTableRepository(db, resources[name]));
		},
		users: createUserRepository(db),
		audit: createAuditRepository(db),
		dashboard: createDashboardRepository(db),
		snapshots: createSnapshotRepository(db),
		imports: createImportRepository(db),
		presentations: createPresentationRepository(db),
		settings: createSettingsRepository(db),
	};
}

module.exports = { createRepositories };
