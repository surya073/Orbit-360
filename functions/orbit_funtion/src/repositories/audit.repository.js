'use strict';

/** Append-only. Only this repository writes audit_logs, and only from the server. */
function createAuditRepository(db) {
	return {
		insert: (row) => db.insert('audit_logs', row),
		insertMany: (rows) => db.insertMany('audit_logs', rows),
	};
}

module.exports = { createAuditRepository };
