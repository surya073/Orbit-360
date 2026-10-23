'use strict';

const { resources } = require('../config/resources');
const { requirePermission } = require('../middleware/authorization');

// Columns the platform adds itself; they never appear in (and are never missing from) a hand-made table definition.
const SYSTEM = new Set(['ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME']);

const nameOf = (c) => c && (c.column_name || c.columnName || c.name);

/**
 * What the code reads and writes for one resource, as a list of column names. Import-only columns (the stable
 * source_record_id and the business-code aliases) only count for tables that can actually be imported.
 */
function expectedColumns(resource) {
	const { importableModules } = require('../validators/imports.validators'); // lazy: avoids a load-order cycle
	const importable = importableModules().includes(resource.name);
	const cols = new Set();
	(resource.list || []).forEach((c) => cols.add(c));
	Object.keys((importable && resource.importFields) || resource.fields || {}).forEach((c) => cols.add(c));
	if (importable) cols.add('source_record_id');
	// Business-code aliases are resolved by the import service and never stored, except where the column really exists.
	['employee_code', 'project_code'].forEach((c) => {
		if (!(resource.list || []).includes(c) && !(resource.fields || {})[c]) cols.delete(c);
	});
	if (resource.softDelete) cols.add('is_deleted');
	if (resource.teamColumn && resource.teamColumn !== 'ROWID') cols.add(resource.teamColumn);
	SYSTEM.forEach((c) => cols.delete(c));
	return [...cols];
}

/** Expected columns per table, merged over every resource that uses the table. */
function expectedByTable() {
	const byTable = new Map();
	for (const r of Object.values(resources)) {
		if (!r.table) continue;
		const set = byTable.get(r.table) || new Set();
		expectedColumns(r).forEach((c) => set.add(c));
		byTable.set(r.table, set);
	}
	return byTable;
}

/**
 * Admin-only schema check: compares each live Data Store table's columns with what the code reads and writes, and
 * reports only NAMES (never row data). It exists because the tables were created by hand: one missing column makes a
 * whole list or save fail with a generic 500, and this says which.
 */
async function check(ctx) {
	requirePermission(ctx, 'access.manage_roles');
	const tables = [];
	for (const [table, expected] of expectedByTable()) {
		try {
			const live = await ctx.db.columns(table);
			const have = new Set((live || []).map(nameOf).filter(Boolean));
			const missing = [...expected].filter((c) => !have.has(c));
			tables.push({ table, ok: missing.length === 0, missing, liveColumns: have.size });
		} catch (err) {
			tables.push({ table, ok: false, missing: [], error: (err && err.code) || 'ERROR' });
		}
	}
	return { ok: tables.every((t) => t.ok), tables };
}

module.exports = { check, expectedColumns, expectedByTable };
