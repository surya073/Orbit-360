// Dev server only (never part of the build). Does nothing unless `npm run start:local` set LOCAL_STUB:
// then the Catalyst SDK script and the API are answered by scripts/dev-stub.js instead of Catalyst.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
	if (!process.env.LOCAL_STUB) return;
	const target = `http://localhost:${process.env.STUB_PORT || 5055}`;
	app.use(['/__catalyst', '/server'], createProxyMiddleware({ target, changeOrigin: true }));
};
