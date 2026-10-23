'use strict';

// When a Data Store call fails for an unexplained reason, the error names the table's missing columns (names only).

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../config/datastore');
const { expectedByTable } = require('../services/schema.service');

/** A minimal admin app: zcql/insert fail with `failure`; getAllColumns returns `live`. */
function app({ failure, live }) {
	let columnLookups = 0;
	return {
		lookups: () => columnLookups,
		zcql: () => ({ executeZCQLQuery: async () => { throw failure; } }),
		datastore: () => ({
			table: () => ({
				insertRow: async () => { throw failure; },
				getAllColumns: async () => { columnLookups += 1; return live.map((c) => ({ column_name: c })); },
			}),
		}),
	};
}

const everything = (table, drop = []) => [...expectedByTable().get(table)].filter((c) => !drop.includes(c));

test('an unexplained select failure on a table with a missing column says which column', async () => {
	const a = app({ failure: new Error('something the platform does not explain'), live: everything('product_items', ['item_priority']) });
	const db = createDb(a, { budget: 10 });
	await assert.rejects(() => db.select('SELECT ROWID, item_priority FROM product_items LIMIT 0, 5', 'product_items'), (err) => {
		assert.equal(err.code, 'DATASTORE_SCHEMA');
		assert.match(err.details[0].message, /product_items is missing column\(s\): item_priority/);
		return true;
	});
	assert.equal(a.lookups(), 1); // one extra request, and only on failure
});

test('a failed write is diagnosed the same way', async () => {
	const a = app({ failure: new Error('mystery'), live: everything('product_items', ['item_priority']) });
	const db = createDb(a, { budget: 10 });
	await assert.rejects(() => db.insert('product_items', { title: 'x', item_priority: 'high' }), (err) => err.code === 'DATASTORE_SCHEMA');
});

test('when no column is missing the original unexplained error is kept (and no row data is invented)', async () => {
	const a = app({ failure: new Error('mystery'), live: everything('product_items') });
	const db = createDb(a, { budget: 10 });
	await assert.rejects(() => db.select('SELECT ROWID FROM product_items LIMIT 0, 5', 'product_items'), (err) => err.code === 'INTERNAL_ERROR');
});

test('the diagnosis never overspends the request budget', async () => {
	const a = app({ failure: new Error('mystery'), live: everything('product_items', ['item_priority']) });
	const db = createDb(a, { budget: 1 }); // the failing call used the only request
	await assert.rejects(() => db.select('SELECT ROWID FROM product_items LIMIT 0, 5', 'product_items'), (err) => err.code === 'INTERNAL_ERROR');
	assert.equal(a.lookups(), 0);
});

test('import-only columns are not expected on tables that cannot be imported (no false alarm for teams)', () => {
	assert.equal(expectedByTable().get('teams').has('source_record_id'), false);
	assert.equal(expectedByTable().get('employees').has('source_record_id'), true);
});
