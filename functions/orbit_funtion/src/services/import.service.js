'use strict';

const crypto = require('crypto');
const { errors, ApiError, classifyDbError } = require('../utils/errors');
const { businessNow } = require('../utils/dateUtils');
const { resources } = require('../config/resources');
const { IMPORT_STATUS: S } = require('../config/constants');
const { environment } = require('../config/environment');
const { validateRecord } = require('../validators/schema');
const { importableModules } = require('../validators/imports.validators');
const { audit, auditBatch } = require('./audit.service');
const { requirePermission, can } = require('../middleware/authorization');
const { KEY, moduleOfResource } = require('../config/permissions');
const { matchKeyFor, prepareRow, loadReferences, applyReferences, immutableFields } = require('./recordRules');

/**
 * Import flow (all bounded: <= IMPORT_BATCH_SIZE rows per call):
 *   1 createJob      upload metadata -> import_jobs row
 *   2 previewBatch   validate + detect conflicts -> import_rows (valid | invalid | conflict); no business writes
 *   3 resolveConflicts   Update | Keep existing | Skip per row (or a job default policy)
 *   4 commitBatch    writes valid rows; re-sending a batch never duplicates data
 *   5 completeJob    freezes counts computed from import_rows
 *
 * The file itself stays with the client; each call carries its batch of rows. This avoids
 * File Store folder configuration and keeps server work proportional to the batch.
 *
 * Idempotency, three layers: (a) import_rows.dedupe_key = jobId|rowNumber and status
 * 'committed' rows are never reprocessed; (b) target rows carry a unique dedupe_key /
 * stable source id so a duplicate insert is rejected by the database; (c) a target row that
 * already carries this job's import_job_id counts as applied (recovers from a batch that
 * failed after writing).
 */

const TERMINAL = new Set([S.COMPLETED, S.COMPLETED_WITH_ERRORS, S.FAILED, S.CANCELLED]);
const TEXT_MAX = 2000;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rowHash = (data) => sha(JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]])));

/** An import writes into the target module, so the actor needs that module's own permission too (not just Imports). */
function requireTarget(ctx, resourceName, action) {
	const module = moduleOfResource(resourceName);
	if (!module) throw errors.badRequest('Import job has an unsupported module');
	requirePermission(ctx, KEY(module, action));
}

async function loadJob(ctx, id) {
	const job = await ctx.repos.imports.findJob(ctx.scope, id);
	if (!job) throw errors.notFound('Import job not found');
	const resource = resources[job.module];
	if (!resource || !resource.fields) throw errors.badRequest('Import job has an unsupported module');
	return { job, resource };
}

function assertOpen(job) {
	if (TERMINAL.has(job.status)) throw errors.conflict(`Import job is ${job.status} and cannot accept more rows`);
}

async function createJob(ctx, body) {
	const { scope, repos } = ctx;
	requireTarget(ctx, body.module, 'create');
	if (body.conflictPolicy === 'update' || body.conflictPolicy === 'ask') requireTarget(ctx, body.module, 'edit'); // may overwrite existing records
	const team = scope.resolveTeam(body.teamId); // managers: pinned; admins: optional
	const dedupeKey = body.fileSha256 ? `${team || 'all'}|${body.module}|${body.fileSha256}` : null;
	const previous = dedupeKey ? await repos.imports.jobsWithKey(dedupeKey) : [];
	const created = await repos.imports.createJob(scope, {
		module: body.module,
		...(team ? { team_id: team } : {}),
		file_name: body.fileName,
		...(body.fileType ? { file_type: body.fileType } : {}),
		...(body.fileSha256 ? { file_sha256: body.fileSha256 } : {}),
		uploaded_by_user_id: ctx.actor.userId,
		status: S.UPLOADED,
		default_conflict_policy: body.conflictPolicy,
		...(body.totalRows ? { total_rows: body.totalRows } : {}),
		...(dedupeKey ? { dedupe_key: dedupeKey } : {}),
	});
	await audit(ctx, { action: 'create', table: 'import_jobs', rowId: created.ROWID, teamId: team, after: { module: body.module, status: S.UPLOADED } });
	return {
		id: String(created.ROWID),
		status: S.UPLOADED,
		module: body.module,
		teamId: team,
		conflictPolicy: body.conflictPolicy,
		batchSize: environment.importBatchSize,
		// Same file already uploaded for this team/module: a warning, not a block.
		possibleDuplicateOfJobs: previous.map((p) => ({ id: String(p.ROWID), status: p.status })),
	};
}

// Imports may reference employees/projects by business code instead of the internal numeric id
// (which users never see). Codes are resolved to ids server-side; ids already given win.
const CODE_REFS = [
	{ fk: 'employee_id', codeCol: 'employee_code', table: 'employees' },
	{ fk: 'project_id', codeCol: 'project_code', table: 'projects' },
];
const SAFE_CODE = /^[A-Za-z0-9 _.\-/:@]{1,100}$/;

/**
 * Fills `<fk>` from `<code>` for the whole batch with ONE lookup per referenced table (chunked at
 * 50). The lookup is unscoped on purpose; team access to the resolved row is then enforced by the
 * normal reference check, so another team's code yields FORBIDDEN_REFERENCE, never a silent link.
 * The code column is removed so it is never written to the target table.
 */
async function resolveBusinessCodes(ctx, resource, items) {
	for (const ref of CODE_REFS) {
		if (!resource.fields[ref.fk]) continue;
		const wanted = items.filter((i) => i.data[ref.codeCol] && !i.data[ref.fk]);
		const bad = (item, message) => {
			item.errors.push({ field: ref.codeCol, code: 'NOT_FOUND', message });
			item.unresolved.add(ref.codeCol);
		};
		const safe = wanted.filter((i) => (typeof i.data[ref.codeCol] === 'string' && SAFE_CODE.test(i.data[ref.codeCol].trim()) ? true : (bad(i, 'Not a valid code'), false)));
		if (safe.length) {
			const found = await ctx.repos.table(ref.table).findByKeys(ctx.scope, ref.codeCol, safe.map((i) => i.data[ref.codeCol].trim()));
			const byCode = new Map(found.filter((r) => r.is_deleted !== true).map((r) => [String(r[ref.codeCol]), String(r.ROWID)]));
			for (const item of safe) {
				const id = byCode.get(item.data[ref.codeCol].trim());
				if (id) item.data[ref.fk] = id;
				else bad(item, `No ${ref.table === 'employees' ? 'employee' : 'project'} with this code`);
			}
		}
		items.forEach((i) => delete i.data[ref.codeCol]);
	}
}

/**
 * Validates and classifies a batch without writing business data. Shared by preview and
 * commit so the two can never disagree. Cost: <= 1 reference query per parent table and
 * <= 1 key lookup per distinct match column (each chunked at 50 keys).
 */
async function evaluateRows(ctx, job, resource, rows) {
	const { scope, repos } = ctx;
	const items = rows.map(({ rowNumber, data }) => ({ rowNumber, errors: [], value: null, match: null, existing: null, hash: rowHash(data), data: { ...data }, unresolved: new Set() }));
	const fail = (item, field, code, message) => item.errors.push({ field, code, message });

	await resolveBusinessCodes(ctx, resource, items);

	for (const item of items) {
		const { value, errors: errs } = validateRecord(resource.importFields, item.data);
		// A code that matched nothing is reported once, on the code column (not as a missing id).
		for (const col of item.unresolved) {
			const i = errs.findIndex((e) => e.field === CODE_REFS.find((r) => r.codeCol === col).fk && e.code === 'REQUIRED');
			if (i >= 0) errs.splice(i, 1);
		}
		for (const rule of resource.crossFieldRules || []) {
			const e = rule(value);
			if (e) errs.push(e);
		}
		item.errors.push(...errs);
		item.value = value;
		delete item.data; // raw values are not kept beyond validation
	}

	const ok = () => items.filter((i) => i.errors.length === 0);
	const refs = await loadReferences(ctx, resource, ok().map((i) => i.value));
	for (const item of ok()) {
		try {
			applyReferences(scope, resource, item.value, refs);
			if (job.team_id && resource.teamColumn && resource.teamColumn !== 'ROWID' && !item.value[resource.teamColumn] && (!resource.teamFrom || resource.teamFrom.optional)) item.value[resource.teamColumn] = String(job.team_id);
		} catch (e) {
			if (!(e instanceof ApiError)) throw e;
			const d = (e.details && e.details[0]) || {};
			fail(item, d.field || null, e.status === 403 ? 'FORBIDDEN_REFERENCE' : d.code || e.code, e.status === 403 ? 'Referenced record belongs to another team' : d.message || e.message);
		}
	}

	const seen = new Map();
	for (const item of ok()) {
		const m = matchKeyFor(resource, item.value);
		if (!m) {
			fail(item, null, 'MISSING_MATCH_KEY', resource.randomDedupe ? 'source_record_id is required for this module' : `One of ${(resource.matchColumns || []).join(', ')} is required for a stable match`);
			continue;
		}
		const k = `${m.column}|${m.key}`;
		if (seen.has(k)) fail(item, null, 'DUPLICATE_IN_BATCH', `Duplicates row ${seen.get(k)} in this batch`);
		else seen.set(k, item.rowNumber);
		item.match = m;
	}

	const byColumn = new Map();
	for (const item of ok()) (byColumn.get(item.match.column) || byColumn.set(item.match.column, []).get(item.match.column)).push(item);
	for (const [column, group] of byColumn) {
		const found = await repos.table(resource.name).findByKeys(scope, column, group.map((i) => i.match.key), ['import_job_id']);
		const index = new Map(found.map((r) => [String(r[column]), r]));
		for (const item of group) {
			const ex = index.get(item.match.key);
			if (!ex) continue;
			const teamCol = resource.teamColumn && resource.teamColumn !== 'ROWID' ? resource.teamColumn : null;
			if (teamCol && !scope.canAccessTeam(ex[teamCol])) fail(item, null, 'FORBIDDEN_TARGET', 'A matching record exists outside your team');
			else item.existing = ex;
		}
	}

	for (const item of items) {
		if (item.errors.length) item.status = 'invalid';
		else if (!item.existing) item.status = 'valid';
		else if (String(item.existing.import_job_id) === String(job.ROWID)) item.status = 'applied';
		else item.status = 'conflict';
	}
	return items;
}

const codes = (errs) => errs.map((e) => e.code).join(',').slice(0, 250) || null;
// Field names and reasons only; never the submitted values.
const detail = (errs) => errs.map((e) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join('; ').slice(0, TEXT_MAX) || null;
const businessKey = (item) => (item.match ? sha(item.match.key).slice(0, 32) : null);

/** Upserts import_rows for a batch in <= 2 requests. Committed rows are never overwritten. */
async function persistRows(ctx, job, entries, storedByNumber) {
	const inserts = [];
	const updates = [];
	for (const e of entries) {
		const stored = storedByNumber.get(e.rowNumber);
		if (stored && stored.status === 'committed') continue;
		const row = {
			import_job_id: String(job.ROWID),
			row_number: e.rowNumber,
			status: e.rowStatus,
			...(e.businessKey ? { business_key: e.businessKey } : {}),
			...(e.targetRowId ? { conflict_target_row_id: String(e.targetRowId) } : {}),
			...(e.resolution ? { resolution: e.resolution } : {}),
			error_codes: e.errorCodes || null,
			error_detail: e.errorDetail || null,
			row_hash: e.hash,
		};
		if (stored) updates.push({ ...row, ROWID: stored.ROWID });
		else inserts.push({ ...row, dedupe_key: `${job.ROWID}|${e.rowNumber}` });
	}
	if (inserts.length) await ctx.repos.imports.insertRows(inserts);
	if (updates.length) await ctx.repos.imports.updateRows(updates);
}

const outcomeOf = (item, rowStatus, extra = {}) => ({
	rowNumber: item.rowNumber,
	status: rowStatus,
	errors: item.errors,
	...extra,
});

async function previewBatch(ctx, jobId, rows) {
	const { job, resource } = await loadJob(ctx, jobId);
	assertOpen(job);
	requireTarget(ctx, resource.name, 'create');
	const [items, stored] = await Promise.all([
		evaluateRows(ctx, job, resource, rows),
		ctx.repos.imports.findRows(job.ROWID, rows.map((r) => r.rowNumber)),
	]);
	const storedBy = new Map(stored.map((s) => [Number(s.row_number), s]));

	const results = [];
	const entries = [];
	for (const item of items) {
		const prior = storedBy.get(item.rowNumber);
		const priorResolution = prior && prior.resolution;
		const rowStatus = item.status === 'applied' ? 'committed' : item.status;
		const res = outcomeOf(item, rowStatus, {
			...(item.status === 'conflict' ? { conflict: { targetRowId: String(item.existing.ROWID), resolution: priorResolution || null } } : {}),
			...(prior && prior.status === 'committed' ? { status: 'committed', alreadyCommitted: true } : {}),
		});
		results.push(res);
		entries.push({
			rowNumber: item.rowNumber,
			rowStatus,
			businessKey: businessKey(item),
			targetRowId: item.existing && item.existing.ROWID,
			resolution: item.status === 'conflict' ? priorResolution : null,
			errorCodes: codes(item.errors),
			errorDetail: detail(item.errors),
			hash: item.hash,
		});
	}
	await persistRows(ctx, job, entries, storedBy);
	if (job.status === S.UPLOADED) await ctx.repos.imports.updateJob(ctx.scope, job, { status: S.VALIDATING });
	return { jobId: String(job.ROWID), rows: results, summary: summarize(results) };
}

async function resolveConflicts(ctx, jobId, resolutions) {
	const { job, resource } = await loadJob(ctx, jobId);
	assertOpen(job);
	requireTarget(ctx, resource.name, 'create');
	if (resolutions.some((r) => r.resolution === 'update')) requireTarget(ctx, resource.name, 'edit');
	const stored = await ctx.repos.imports.findRows(job.ROWID, resolutions.map((r) => r.rowNumber));
	const byNumber = new Map(stored.map((s) => [Number(s.row_number), s]));
	const now = businessNow();
	const updates = [];
	const results = resolutions.map((r) => {
		const s = byNumber.get(r.rowNumber);
		if (!s) return { rowNumber: r.rowNumber, ok: false, code: 'NOT_PREVIEWED', message: 'Row has not been previewed' };
		if (s.status !== 'conflict') return { rowNumber: r.rowNumber, ok: false, code: 'NOT_A_CONFLICT', message: `Row status is ${s.status}` };
		updates.push({ ROWID: s.ROWID, resolution: r.resolution, resolved_by_user_id: ctx.actor.userId, resolved_at: now });
		return { rowNumber: r.rowNumber, ok: true, resolution: r.resolution };
	});
	if (updates.length) await ctx.repos.imports.updateRows(updates);
	await audit(ctx, { action: 'conflict_resolve', table: 'import_jobs', rowId: job.ROWID, teamId: job.team_id, importJobId: job.ROWID, after: { resolved: updates.length } });
	return { jobId: String(job.ROWID), results };
}

async function commitBatch(ctx, jobId, rows) {
	const { scope, repos } = ctx;
	const { job, resource } = await loadJob(ctx, jobId);
	assertOpen(job);
	requireTarget(ctx, resource.name, 'create');
	const repo = repos.table(resource.name);

	const stored = await repos.imports.findRows(job.ROWID, rows.map((r) => r.rowNumber));
	const storedBy = new Map(stored.map((s) => [Number(s.row_number), s]));
	const final = new Set(stored.filter((s) => s.status === 'committed').map((s) => Number(s.row_number)));

	const todo = rows.filter((r) => !final.has(r.rowNumber));
	const items = todo.length ? await evaluateRows(ctx, job, resource, todo) : [];

	const policy = job.default_conflict_policy;
	const plan = { insert: [], update: [] };
	const entries = new Map(); // rowNumber -> persisted state
	const results = new Map();

	for (const rn of final) results.set(rn, { rowNumber: rn, status: 'committed', outcome: 'already_committed', errors: [] });

	for (const item of items) {
		const base = { rowNumber: item.rowNumber, businessKey: businessKey(item), errorCodes: codes(item.errors), errorDetail: detail(item.errors), hash: item.hash, targetRowId: item.existing && item.existing.ROWID };
		const done = (rowStatus, outcome, extra = {}) => {
			entries.set(item.rowNumber, { ...base, rowStatus, ...extra });
			results.set(item.rowNumber, { rowNumber: item.rowNumber, status: rowStatus, outcome, errors: item.errors });
		};
		if (item.status === 'invalid') done('invalid', 'invalid');
		else if (item.status === 'applied') done('committed', 'already_applied'); // an earlier attempt already wrote it
		else if (item.status === 'valid') plan.insert.push(item);
		else {
			const prior = storedBy.get(item.rowNumber);
			const resolution = (prior && prior.resolution) || (policy !== 'ask' ? policy : null);
			if (!resolution) done('conflict', 'unresolved_conflict');
			else if (resolution === 'update') plan.update.push({ item, resolution });
			else done('skipped', 'skipped', { resolution });
		}
	}

	const failBulk = (group, err) => {
		const { error } = classifyDbError(err);
		for (const g of group) {
			const item = g.item || g;
			entries.set(item.rowNumber, { rowNumber: item.rowNumber, businessKey: businessKey(item), hash: item.hash, rowStatus: 'failed', errorCodes: error.code, errorDetail: (`Write failed: ${error.message}${error.details ? ' (' + error.details[0].message + ')' : ''}`).slice(0, 2000), targetRowId: item.existing && item.existing.ROWID });
			results.set(item.rowNumber, { rowNumber: item.rowNumber, status: 'failed', outcome: 'write_failed', errors: [{ field: null, code: error.code, message: `Write failed: ${error.message}${error.details ? ' (' + error.details[0].message + ')' : ''}. The batch can be retried safely.` }] });
		}
	};

	const audits = [];
	if (plan.insert.length) {
		const toWrite = plan.insert.map((item) => stamp(ctx, resource, prepareRow(resource, item.value, { source: 'import', jobId: job.ROWID })));
		try {
			const inserted = await repo.insertMany(scope, toWrite);
			if (!Array.isArray(inserted) || inserted.length !== toWrite.length) throw new Error('unexpected bulk insert result');
			plan.insert.forEach((item, i) => {
				const rid = inserted[i].ROWID;
				entries.set(item.rowNumber, { rowNumber: item.rowNumber, businessKey: businessKey(item), hash: item.hash, rowStatus: 'committed', targetRowId: rid });
				results.set(item.rowNumber, { rowNumber: item.rowNumber, status: 'committed', outcome: 'created', errors: [] });
				audits.push({ action: 'import_commit', table: resource.table, rowId: rid, teamId: toWrite[i].team_id || toWrite[i][resource.teamColumn], importJobId: job.ROWID, after: toWrite[i] });
			});
		} catch (err) {
			failBulk(plan.insert, err);
		}
	}
	if (plan.update.length) {
		const patches = plan.update.map(({ item }) => {
			const row = stamp(ctx, resource, prepareRow(resource, item.value, { source: 'import', jobId: job.ROWID }));
			return { ...row, ROWID: item.existing.ROWID };
		});
		try {
			await repo.updateMany(scope, patches);
			plan.update.forEach(({ item, resolution }, i) => {
				entries.set(item.rowNumber, { rowNumber: item.rowNumber, businessKey: businessKey(item), hash: item.hash, rowStatus: 'committed', targetRowId: item.existing.ROWID, resolution });
				results.set(item.rowNumber, { rowNumber: item.rowNumber, status: 'committed', outcome: 'updated', errors: [] });
				audits.push({ action: 'import_commit', table: resource.table, rowId: item.existing.ROWID, importJobId: job.ROWID, after: patches[i], reason: 'conflict resolved: update' });
			});
		} catch (err) {
			failBulk(plan.update, err);
		}
	}

	await persistRows(ctx, job, [...entries.values()], storedBy);
	await auditBatch(ctx, audits);
	if (job.status !== S.COMMITTING) await repos.imports.updateJob(scope, job, { status: S.COMMITTING, ...(job.started_at ? {} : { started_at: businessNow() }) });

	const ordered = rows.map((r) => results.get(r.rowNumber));
	return { jobId: String(job.ROWID), rows: ordered, summary: summarize(ordered) };
}

/** An imported time entry that is already approved records who imported it and when. */
function stamp(ctx, resource, row) {
	if (resource.table === 'time_entries' && row.approval_status === 'approved') {
		row.approved_by_user_id = ctx.actor.userId;
		row.approved_at = businessNow();
	}
	return row;
}

function summarize(results) {
	const s = {};
	for (const r of results) s[r.status] = (s[r.status] || 0) + 1;
	return s;
}

async function countsFor(ctx, jobId) {
	const rows = await ctx.repos.imports.jobRowCounts(jobId);
	const byStatus = {};
	let total = 0;
	for (const r of rows) {
		const n = Number(r.rows_count) || 0;
		byStatus[r.status] = (byStatus[r.status] || 0) + n;
		total += n;
	}
	return { total, byStatus };
}

async function getJob(ctx, id) {
	const { job } = await loadJob(ctx, id);
	return { ...job, liveCounts: await countsFor(ctx, job.ROWID) };
}

/** Writes the final counts (computed once, from import_rows) and the terminal status. */
async function completeJob(ctx, id) {
	const { job } = await loadJob(ctx, id);
	if (job.status === S.CANCELLED) throw errors.conflict('Import job was cancelled');
	const groups = await ctx.repos.imports.jobRowCounts(job.ROWID, true);
	const c = { valid: 0, invalid: 0, conflict: 0, skipped: 0, committed: 0, failed: 0, total: 0, created: 0, updated: 0 };
	for (const g of groups) {
		const n = Number(g.rows_count) || 0;
		c.total += n;
		c[g.status] = (c[g.status] || 0) + n;
		if (g.status === 'committed') c[g.resolution === 'update' ? 'updated' : 'created'] += n;
	}
	// A job whose rows cannot be counted must not be reported as a success.
	if (c.total === 0) throw errors.conflict('No row results were recorded for this import, so it cannot be completed. Nothing was reported as imported.');
	const problems = c.invalid + c.failed + c.conflict + c.valid; // valid but never committed also needs attention
	const status = problems === 0 ? S.COMPLETED : S.COMPLETED_WITH_ERRORS;
	await ctx.repos.imports.updateJob(ctx.scope, job, {
		status,
		total_rows: c.total,
		valid_rows: c.committed + c.skipped + c.valid,
		invalid_rows: c.invalid,
		conflict_rows: c.conflict,
		skipped_rows: c.skipped,
		created_rows: c.created,
		updated_rows: c.updated,
		failed_rows: c.failed,
		finished_at: businessNow(),
		error_summary: problems ? `invalid:${c.invalid} failed:${c.failed} unresolved_conflict:${c.conflict} not_committed:${c.valid}` : null,
	});
	await audit(ctx, { action: 'import_commit', table: 'import_jobs', rowId: job.ROWID, teamId: job.team_id, importJobId: job.ROWID, after: { status, ...c } });
	return { jobId: String(job.ROWID), status, counts: c };
}

async function cancelJob(ctx, id) {
	const { job } = await loadJob(ctx, id);
	if (TERMINAL.has(job.status)) throw errors.conflict(`Import job is already ${job.status}`);
	await ctx.repos.imports.updateJob(ctx.scope, job, { status: S.CANCELLED, finished_at: businessNow() });
	return { jobId: String(job.ROWID), status: S.CANCELLED };
}

async function listRows(ctx, id, query) {
	const { job } = await loadJob(ctx, id);
	return ctx.repos.imports.listRows(job.ROWID, query);
}

/** Field contracts for every writable resource (drives forms and CSV templates). */
function templates(actor) {
	const importable = importableModules();
	return Object.values(resources)
		.filter((r) => r.fields)
		.map((r) => ({
			module: r.name,
			importable: importable.includes(r.name),
			// What the signed-in user may do with this record type (the forms and the spreadsheet follow it).
			permissions: { view: can(actor, KEY(moduleOfResource(r.name), 'view')), create: can(actor, KEY(moduleOfResource(r.name), 'create')), edit: can(actor, KEY(moduleOfResource(r.name), 'edit')), delete: can(actor, KEY(moduleOfResource(r.name), 'delete')) },
			adminOnly: !can(actor, KEY(moduleOfResource(r.name), 'create')), // legacy flag: "this user cannot add records"

			immutable: [...immutableFields(r)],
			columns: Object.entries(r.fields).map(([field, spec]) => ({
				field,
				type: spec.t,
				required: Boolean(spec.req),
				...(spec.max ? { maxLength: spec.max } : {}),
				...(spec.values ? { values: spec.values } : {}),
			})),
			importColumns: r.importColumns,
		}));
}

module.exports = { createJob, previewBatch, resolveConflicts, commitBatch, completeJob, cancelJob, getJob, listRows, templates, evaluateRows };
