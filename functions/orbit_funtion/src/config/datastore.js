'use strict';

/**
 * Data Store access via the supported Catalyst SDK (zcatalyst-sdk-node):
 *   app.zcql().executeZCQLQuery(sql)           - SELECT / aggregates
 *   app.datastore().table(name).insertRow(s)   - writes (bulk: max 200 rows)
 *   app.datastore().table(name).updateRow(s)
 *
 * Every call is counted against a per-request budget because Data Store is billed per
 * request; exceeding it aborts the request instead of silently running up cost.
 * Quirks handled here: ZCQL results are wrapped under the table name, aggregate rows are
 * flattened, boolean columns arrive as the strings "true"/"false".
 */

const { ApiError, errors, classifyDbError } = require('../utils/errors');

const MAX_BULK = 200;

function flattenRow(row) {
	const out = {};
	for (const v of Object.values(row)) if (v && typeof v === 'object') Object.assign(out, v);
	return out;
}

const AGG_ITEM = /^\s*(COUNT|SUM|AVG|MIN|MAX)\(\s*([\w*]+)\s*\)\s*(?:AS\s+(\w+))?\s*$/i;

/** Top-level SELECT items (aggregate arguments contain no commas in this codebase). */
function selectItems(sql) {
	const m = /^\s*SELECT\s+(.+?)\s+FROM\s/is.exec(sql);
	return m ? m[1].split(',') : [];
}

/**
 * Callers read aggregates by alias (`COUNT(ROWID) AS total`). Data Store may return the column
 * under the alias OR under the expression text (`COUNT(ROWID)`), so both are accepted: whichever
 * is present is copied to the alias. If neither is present the keys (never values) are logged and
 * the alias stays missing, so callers see "no value" rather than a wrong number.
 */
function normalizeAggregates(sql, rows, logger) {
	const wanted = selectItems(sql).map((s) => AGG_ITEM.exec(s)).filter((m) => m && m[3]);
	if (wanted.length === 0) return rows;
	return rows.map((row) => {
		const out = { ...row };
		for (const [, fn, arg, alias] of wanted) {
			if (alias in out) continue;
			const expr = `${fn}(${arg})`.toLowerCase();
			const key = Object.keys(out).find((k) => k.replace(/\s+/g, '').toLowerCase() === expr);
			if (key !== undefined) out[alias] = out[key];
			else if (logger) logger.warn('aggregate_alias_missing', { alias, expected: expr, gotKeys: Object.keys(row).join('|') });
		}
		return out;
	});
}

function convertBooleans(row, bools = []) {
	if (!bools.length) return row;
	const out = { ...row };
	for (const c of bools) {
		if (!(c in out)) continue;
		// Unset stays unset; it is never coerced to false.
		out[c] = out[c] === null || out[c] === undefined || out[c] === '' ? null : out[c] === 'true' || out[c] === true;
	}
	return out;
}

function createDb(adminApp, { budget = 30, logger } = {}) {
	const zcql = adminApp.zcql();
	const datastore = adminApp.datastore();
	let used = 0;

	/**
	 * When a call fails for a reason the platform does not explain, the usual culprit on hand-made tables is a column the
	 * code uses that the table lacks. One extra request compares the live columns with the expected ones (names only) so
	 * the error can say which, instead of a bare "unexpected error". Skipped when the budget is spent.
	 */
	const missingColumns = async (table) => {
		if (!table || used >= budget) return null;
		try {
			const { expectedByTable } = require('../services/schema.service'); // lazy: that module needs the resources registry
			const expected = expectedByTable().get(table);
			if (!expected) return null;
			used += 1;
			const live = await datastore.table(table).getAllColumns();
			const have = new Set((live || []).map((c) => c && (c.column_name || c.columnName || c.name)).filter(Boolean));
			const missing = [...expected].filter((c) => !have.has(c));
			return missing.length ? missing : null;
		} catch {
			return null;
		}
	};

	const run = async (kind, fn, table) => {
		if (++used > budget) throw errors.budget();
		try {
			return await fn();
		} catch (err) {
			let { error, kind: cls } = classifyDbError(err);
			if (cls === 'unknown') {
				const missing = await missingColumns(table);
				if (missing) {
					cls = 'schema';
					error = new ApiError(500, 'DATASTORE_SCHEMA', 'The data model does not match the server configuration');
					error.details = [{ message: `Table ${table} is missing column(s): ${missing.join(', ')}. Add them in the Data Store (see data/database-schema.md).` }];
					if (logger) logger.warn('datastore_schema_mismatch', { op: kind, table, missing: missing.join('|') });
					throw error;
				}
			}
			// Schema and permission failures name tables/columns/privileges, never row values, so
			// the platform's wording is kept (log + error details) to make misconfiguration fixable.
			const diagnostic = cls === 'schema' || cls === 'permission' ? String((err && err.message) || '').slice(0, 300) : undefined;
			if (diagnostic) error.details = [{ message: diagnostic }];
			if (logger && cls !== 'api') logger.warn('datastore_error', { op: kind, class: cls, diagnostic });
			throw error;
		}
	};

	return {
		/** SELECT returning plain rows (table wrapper removed). */
		async select(sql, table, bools) {
			const result = await run('select', () => zcql.executeZCQLQuery(sql), table);
			return result.map((r) => convertBooleans(r[table] || flattenRow(r), bools));
		},
		/** Aggregate / GROUP BY queries; returns flat rows keyed by alias or column. */
		async aggregate(sql) {
			const from = /sFROMs+(w+)/i.exec(sql);
			const result = await run('aggregate', () => zcql.executeZCQLQuery(sql), from && from[1]);
			return normalizeAggregates(sql, result.map(flattenRow), logger);
		},
		async count(sql) {
			const rows = await this.aggregate(sql);
			return Number((rows[0] && rows[0].total) || 0);
		},
		/** Live column definitions of a table (one request); used only by the admin schema check. */
		columns: (table) => run('columns', () => datastore.table(table).getAllColumns()),
		insert: (table, row) => run('insert', () => datastore.table(table).insertRow(row), table),
		update: (table, row) => run('update', () => datastore.table(table).updateRow(row), table),
		/** One bulk request. Callers must keep batches bounded (<= 200 rows). */
		insertMany(table, rows) {
			if (rows.length === 0) return Promise.resolve([]);
			if (rows.length > MAX_BULK) throw new Error('bulk insert exceeds 200 rows');
			return run('insertMany', () => datastore.table(table).insertRows(rows), table);
		},
		updateMany(table, rows) {
			if (rows.length === 0) return Promise.resolve([]);
			if (rows.length > MAX_BULK) throw new Error('bulk update exceeds 200 rows');
			return run('updateMany', () => datastore.table(table).updateRows(rows), table);
		},
		stats: () => ({ queries: used, budget }),
	};
}

module.exports = { createDb, flattenRow, convertBooleans, normalizeAggregates, MAX_BULK };
