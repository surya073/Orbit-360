'use strict';

const ok = (data, meta) => ({ ok: true, data, ...(meta ? { meta } : {}) });

const paged = (rows, { page, pageSize, total }) => ok(rows, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

function send(res, status, body, extraHeaders = {}) {
	if (res.headersSent) return;
	res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
	res.end(JSON.stringify(body));
}

module.exports = { ok, paged, send };
