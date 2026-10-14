'use strict';

const ROLES = Object.freeze({ ADMIN: 'admin', MANAGER: 'manager' });

// Hard upper bounds. Environment settings may lower these but never raise them.
const LIMITS = Object.freeze({
	maxPageSize: 100,
	defaultPageSize: 25,
	maxPage: 100000,
	maxIdsLookup: 100, // ids=1,2,3 style lookups
	maxInClause: 50, // keys per IN (...) query chunk
	maxDashboardDays: 366,
	// Trends are one grouped query by day; time_entries yields <= 2 rows/day and
	// attendance <= 3 rows/day, so 90 days stays under ZCQL's 300-row result cap.
	maxTrendDays: 90,
	maxImportBatch: 100,
	maxBodyBytes: 2 * 1024 * 1024,
	maxSlides: 50,
	maxTextConfig: 9000, // Data Store text columns hold 10,000 characters
});

/** Completeness vocabulary returned with every dashboard metric. */
const COMPLETENESS = Object.freeze({
	COMPLETE: 'complete',
	PARTIAL: 'partial',
	INSUFFICIENT: 'insufficient_data',
	NOT_APPLICABLE: 'not_applicable',
});

const IMPORT_STATUS = Object.freeze({
	UPLOADED: 'uploaded',
	VALIDATING: 'validating',
	VALIDATED: 'validated',
	COMMITTING: 'committing',
	COMPLETED: 'completed',
	COMPLETED_WITH_ERRORS: 'completed_with_errors',
	FAILED: 'failed',
	CANCELLED: 'cancelled',
});

const CONFLICT_POLICIES = ['update', 'keep_existing', 'skip', 'ask'];
const RESOLUTIONS = ['update', 'keep_existing', 'skip'];

module.exports = { ROLES, LIMITS, COMPLETENESS, IMPORT_STATUS, CONFLICT_POLICIES, RESOLUTIONS, API_PREFIX: '/api/v1' };
