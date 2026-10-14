'use strict';

const { assertScope } = require('../services/scope.service');
const { lit } = require('./queryBuilder');
const { LIMITS } = require('../config/constants');

const JOB_COLS = ['ROWID', 'module', 'team_id', 'file_name', 'file_type', 'file_sha256', 'uploaded_by_user_id', 'status', 'default_conflict_policy', 'total_rows', 'valid_rows', 'invalid_rows', 'conflict_rows', 'created_rows', 'updated_rows', 'skipped_rows', 'failed_rows', 'started_at', 'finished_at', 'error_summary', 'CREATEDTIME'];
const ROW_COLS = ['ROWID', 'import_job_id', 'row_number', 'status', 'business_key', 'conflict_target_row_id', 'resolution', 'error_codes', 'error_detail', 'row_hash'];

/** import_jobs / import_rows. Jobs are team-scoped; rows are only reachable through their job. */
function createImportRepository(db) {
	return {
		createJob(scope, row) {
			assertScope(scope);
			scope.assertTeam(row.team_id);
			return db.insert('import_jobs', row);
		},

		async findJob(scope, id) {
			assertScope(scope);
			const cond = [`ROWID = ${lit('id', id)}`];
			const t = scope.condition('team_id');
			if (t) cond.push(t);
			const rows = await db.select(`SELECT ${JOB_COLS.join(', ')} FROM import_jobs WHERE ${cond.join(' AND ')} LIMIT 0, 1`, 'import_jobs');
			return rows[0] || null;
		},

		updateJob(scope, job, patch) {
			assertScope(scope);
			return db.update('import_jobs', { ...patch, ROWID: job.ROWID });
		},

		/** Warns about re-uploads of an identical file (same team/module/sha). */
		async jobsWithKey(dedupeKey) {
			return db.select(`SELECT ROWID, status, CREATEDTIME FROM import_jobs WHERE dedupe_key = ${lit('str', dedupeKey)} ORDER BY ROWID desc LIMIT 0, 5`, 'import_jobs');
		},

		/** Per-status counts (optionally split by resolution): one grouped query, <= ~12 rows. */
		jobRowCounts(jobId, withResolution = false) {
			const cols = withResolution ? 'status, resolution' : 'status';
			return db.aggregate(`SELECT ${cols}, COUNT(ROWID) AS rows_count FROM import_rows WHERE import_job_id = ${lit('id', jobId)} GROUP BY ${cols}`);
		},

		/** Row records for specific row numbers of a job, in chunks of <= 50. */
		async findRows(jobId, rowNumbers) {
			const keys = [...new Set(rowNumbers)].map((n) => `${jobId}|${n}`);
			const out = [];
			for (let i = 0; i < keys.length; i += LIMITS.maxInClause) {
				const chunk = keys.slice(i, i + LIMITS.maxInClause);
				out.push(...(await db.select(`SELECT ${ROW_COLS.join(', ')} FROM import_rows WHERE dedupe_key IN (${chunk.map((k) => lit('str', k)).join(', ')}) LIMIT 0, ${LIMITS.maxInClause}`, 'import_rows')));
			}
			return out;
		},

		insertRows: (rows) => db.insertMany('import_rows', rows),
		updateRows: (rows) => db.updateMany('import_rows', rows),

		async listRows(jobId, { status, paging }) {
			const where = [`import_job_id = ${lit('id', jobId)}`];
			if (status) where.push(`status = ${lit('str', status)}`);
			const w = where.join(' AND ');
			const [total, rows] = await Promise.all([
				db.count(`SELECT COUNT(ROWID) AS total FROM import_rows WHERE ${w}`),
				db.select(`SELECT ${ROW_COLS.join(', ')} FROM import_rows WHERE ${w} ORDER BY row_number asc LIMIT ${paging.offset}, ${paging.pageSize}`, 'import_rows'),
			]);
			return { rows, total, page: paging.page, pageSize: paging.pageSize };
		},
	};
}

module.exports = { createImportRepository };
