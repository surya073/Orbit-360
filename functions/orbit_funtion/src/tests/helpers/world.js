'use strict';

const { createApp } = require('../../app');
const { loadEnvironment } = require('../../config/environment');
const { createLogger } = require('../../utils/logger');
const { createStore, createMemoryCatalyst, call } = require('./memoryCatalyst');

const silent = createLogger({}, 'error', { log() {}, warn() {}, error() {} });

/**
 * Two teams, five users, a few employees/projects. ROWIDs are assigned per table starting at 1001:
 * teams 1001 (T1) / 1002 (T2); employees 1001-1003 in T1, 1004 in T2; projects 1001-1002 in T1, 1003 in T2.
 * Catalyst user ids: 900 admin, 901 manager of T1, 902 manager of T2, 903 inactive, 904 manager without team.
 */
function buildWorld({ env = {}, latencyMs = 0, hooks, aggregateKeys } = {}) {
	const store = createStore();
	const T = (n) => store.insert('teams', { team_code: `T${n}`, name: `Team ${n}`, is_active: 'true' });
	const t1 = T(1);
	const t2 = T(2);
	const user = (catalyst, role, team, extra = {}) => store.insert('users', { catalyst_user_id: String(catalyst), email: `u${catalyst}@example.com`, app_role: role, ...(team ? { team_id: team.ROWID } : {}), is_active: 'true', ...extra });
	user(900, 'admin');
	user(901, 'manager', t1);
	user(902, 'manager', t2);
	user(903, 'manager', t1, { is_active: 'false' });
	user(904, 'manager', null);

	const emp = (name, team, extra = {}) => store.insert('employees', { full_name: name, employee_code: `E-${name}`, email_normalized: `${name.toLowerCase()}@example.com`, primary_team_id: team.ROWID, employment_status: 'active', is_deleted: 'false', ...extra });
	const e1 = emp('Asha', t1);
	const e2 = emp('Bala', t1);
	const e3 = emp('Chitra', t1);
	const e4 = emp('Dev', t2);
	const proj = (name, team) => store.insert('projects', { project_name: name, project_code: `P-${name}`, team_id: team.ROWID, is_deleted: 'false' });
	const p1 = proj('Alpha', t1);
	const p2 = proj('Beta', t1);
	const p3 = proj('Gamma', t2);

	const environment = { ...loadEnvironment({}), ...env };
	const app = createApp({ catalyst: createMemoryCatalyst(store, { latencyMs, hooks, aggregateKeys }), env: environment, logger: silent });
	const api = (user, method, url, body) => call(app, { method, url: `/api/v1${url}`, user, body });
	return { store, api, t1, t2, e: [e1, e2, e3, e4], p: [p1, p2, p3], ids: { admin: 900, mgr1: 901, mgr2: 902, inactive: 903, noTeam: 904 } };
}

const timeEntry = (w, over = {}) => ({ employee_id: w.e[0].ROWID, project_id: w.p[0].ROWID, team_id: w.t1.ROWID, work_date: '2026-10-05', duration_minutes: 60, is_billable: 'true', approval_status: 'approved', is_deleted: 'false', dedupe_key: `k${Math.random()}`, ...over });

module.exports = { buildWorld, timeEntry };
