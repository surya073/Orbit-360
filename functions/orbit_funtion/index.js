'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { createApp } = require('./src/app');

// Catalyst Advanced I/O contract: export a (req, res) handler. Built once per cold start.
// Callable as /server/orbit_funtion/api/v1/<route>; GET /server/orbit_funtion/health is public.
module.exports = createApp({ catalyst });
