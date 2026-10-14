'use strict';

const REDACT = new Set(['reason', 'late_reason', 'work_description', 'comments', 'description', 'email_normalized', 'more_details', 'usage_purpose', 'slides_config']);

function redact(obj) {
	if (!obj) return null;
	const out = {};
	for (const [k, v] of Object.entries(obj)) out[k] = REDACT.has(k) ? '[redacted]' : v;
	const s = JSON.stringify(out);
	return s.length > 8000 ? s.slice(0, 8000) : s;
}

const toRow = (ctx, e) => ({
	actor_user_id: ctx.actor.userId,
	action: e.action,
	entity_table: e.table,
	entity_row_id: e.rowId,
	...(e.teamId ? { team_id: e.teamId } : {}),
	...(e.importJobId ? { import_job_id: e.importJobId } : {}),
	before_json: redact(e.before),
	after_json: redact(e.after),
	reason: e.reason || null,
	request_id: ctx.requestId,
});

/**
 * Append-only audit trail. A failure is logged (without values) but does not undo the
 * business write: Data Store has no transactions. Monitor `audit_write_failed` logs.
 */
async function audit(ctx, entry) {
	try {
		await ctx.repos.audit.insert(toRow(ctx, entry));
	} catch (err) {
		ctx.logger.error('audit_write_failed', { table: entry.table, action: entry.action, code: err && err.code });
	}
}

/** One bulk request for many entries (import batches). */
async function auditBatch(ctx, entries) {
	if (entries.length === 0) return;
	try {
		await ctx.repos.audit.insertMany(entries.map((e) => toRow(ctx, e)));
	} catch (err) {
		ctx.logger.error('audit_write_failed', { count: entries.length, code: err && err.code });
	}
}

module.exports = { audit, auditBatch, redact };
