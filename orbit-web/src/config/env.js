// Environment configuration. Only non-secret, build-time values live here.
// Secrets stay server-side (Catalyst function environment variables); see .env.example.
const env = {
	// Same-origin Catalyst function URL; override per environment with REACT_APP_API_BASE.
	apiBase: (process.env.REACT_APP_API_BASE || '/server/orbit_funtion/api/v1').replace(/\/+$/, ''),
	sdkWaitMs: Number(process.env.REACT_APP_SDK_WAIT_MS || 4000),
	isProd: process.env.NODE_ENV === 'production',
};

export default env;
