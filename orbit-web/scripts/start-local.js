/* eslint-disable */
// `npm run start:local`: the fake backend + the React dev server together, signed in as a test user.
const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env, LOCAL_STUB: '1' };
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32', cwd: path.join(__dirname, '..') });

const stub = run('node', ['scripts/dev-stub.js']);
const app = run('npx', ['react-scripts', 'start']);
const stop = () => {
	stub.kill();
	app.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', () => stub.kill());
stub.on('exit', () => app.kill());
