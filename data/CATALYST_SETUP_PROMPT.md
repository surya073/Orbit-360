# Prompt: complete the Catalyst setup for Orbit 360 (Company 360)

Paste everything below the line into the other Claude account (the one that has the Catalyst MCP / Console access).

---

You are setting up the Zoho Catalyst backend resources for an existing, already-deployed application called **Orbit 360 (Company 360)**. The code is finished and deployed. Your job is ONLY the Catalyst-side data model and configuration, so that every feature works with real data. Work autonomously, do not stop to ask routine questions, and finish with a precise report.

## 1. Target (verify before touching anything)
- Catalyst account: **suryatechie63@gmail.com** (if you use the CLI, `catalyst whoami` must print exactly this).
- Project: **orbit360**, id **46135000000311001**, org id **60073973215**, environment **Development**.
- App: https://orbit360-60073973215.development.catalystserverless.in/app/index.html
- API base: https://orbit360-60073973215.development.catalystserverless.in/server/orbit_funtion/api/v1 (public health check: `GET /health`).
- Backend: one Advanced I/O function `orbit_funtion` (node22). Frontend: Web Client `orbit-web`.
- The same account owns OTHER projects (MG-Motor-AU, sync-bridge, dynamic-dashboard). **Never read, change or deploy to them.** If the active project is not orbit360, stop and report.

## 2. Hard rules
- The plan allows only about **2000 function invocations in total** and about 160 are already used. Every API call to the function counts. Make no loops, no polling, no repeated smoke tests. Prefer the Console / MCP / CLI over calling the app's API.
- Do NOT delete or overwrite existing rows, do NOT drop or rename tables or columns, do NOT recreate existing tables. Only ADD what is missing.
- Never print or store passwords or tokens in your report.
- Do not redeploy the function or client unless a step below says so. Code changes are out of scope.

## 3. What already exists
Data Store has these 22 tables (created by hand earlier): teams, users, employees, projects, project_assignments, time_entries, attendance_records, leave_records, performance_records, metric_definitions, ai_usage_records, product_items, application_settings, report_snapshots, import_jobs, import_rows, audit_logs, custom_fields, team_memberships and the rest of the original set. The source of truth for every table is in the repository: `data/database-schema.md` and `data/company360.schema.json` (if you cannot read the repo, use the Console's own column lists and the definitions in this prompt). Booleans are stored as the strings `true` / `false`. System columns (ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME) are automatic.
Sample data is already imported (12 employees, 6 projects, assignments, 84 time entries, attendance, leave, AI usage). Sign-in works for karthickbala112@gmail.com (admin row exists in `users`).

## 4. Tasks, in this order

### Task 1: Close every column gap in the existing tables
1. For each existing table, compare the live columns with `data/database-schema.md`. List missing columns.
2. Known gap: table **product_items** has no column **priority**. Add: name `priority`, type Var Char, max length 20, not mandatory, not unique.
3. Also verify these in the live tables and add anything missing (same rule: add only): `users` (catalyst_user_id unique, email unique, display_name, app_role, team_id, employee_id, is_active), `teams` (team_code, name, description, is_active), `time_entries` (approval_status, source_record_id, dedupe_key, is_deleted), `import_jobs`, `import_rows`, `audit_logs`, `custom_fields`, `application_settings`, `report_snapshots`, `presentations` / presentation table if present in the schema.
4. Do not add `source_record_id` to `teams` (teams are never imported).
Report each change as "table.column: added".

### Task 2: Create the four access tables (they do NOT exist yet)
Create exactly these tables with exactly these columns. Use the same table permissions as `users` and `employees`; do NOT grant App User access to any of them.

**roles**
| column | type | mandatory | unique |
|---|---|---|---|
| role_key | Var Char 40 | yes | YES |
| name | Var Char 100 | yes | no |
| description | Var Char 300 | no | no |
| scope_type | Var Char 12 | yes | no |
| is_system | Boolean | no | no |
| is_active | Boolean | no | no |

**role_permissions**
| column | type | mandatory | unique |
|---|---|---|---|
| role_id | Foreign key -> roles.ROWID, on delete cascade | yes | no |
| permission_key | Var Char 80 | yes | no |
| is_allowed | Boolean | no | no |
| dedupe_key | Var Char 140 | yes | YES |

**user_roles**
| column | type | mandatory | unique |
|---|---|---|---|
| user_id | Foreign key -> users.ROWID, on delete cascade | yes | YES |
| role_id | Foreign key -> roles.ROWID (restrict if the Console allows) | yes | no |
| assigned_by_user_id | Foreign key -> users.ROWID | no | no |

**user_permissions**
| column | type | mandatory | unique |
|---|---|---|---|
| user_id | Foreign key -> users.ROWID, on delete cascade | yes | no |
| permission_key | Var Char 80 | yes | no |
| effect | Var Char 10 | yes | no |
| dedupe_key | Var Char 140 | yes | YES |

Seeding rows is optional and NOT needed: without rows the app uses the built-in Administrator and Manager roles. Do not insert role rows.

### Task 3: Function environment variables (Functions -> orbit_funtion -> Environment variables)
Set (do not invent secrets; ask the account owner only if a value is genuinely unknown):
- `CATALYST_APP_ROLE_ID` = the id of the Catalyst Authentication role used for invited people (Authentication -> Roles, e.g. "App User"). Needed for the in-app "Invite user" feature.
- `INVITE_REDIRECT_URL` = https://orbit360-60073973215.development.catalystserverless.in/app/index.html
- `INVITE_SENDER_EMAIL` = optional; only if a verified sender exists.
- Leave `QUERY_BUDGET`, `USER_CACHE_SECONDS`, `IMPORT_BATCH_SIZE`, `REQUEST_TIMEOUT_MS`, `LOG_LEVEL` at their defaults.
Note: environment variables set in the Console may be reset by a later `catalyst deploy` if the repo's `functions/orbit_funtion/catalyst-config.json` has an empty `env_variables`. If you can, also record the values so the owner can add them to that file (non-secret values only).

### Task 4: Authentication settings
Confirm Authentication is enabled with the embedded/hosted sign-in the app uses, that the Development domain above is an allowed redirect/domain, and that the users we need exist: karthickbala112@gmail.com (admin, already works). For `suryatechie63@gmail.com`, report whether an Authentication user exists; if one does, report its User ID and whether a matching `users` row exists (do not create rows unless the user ID is known; if you do create one: catalyst_user_id = that ID, email lowercase, display_name, app_role = admin, is_active = true, team_id empty).
Do NOT enable "Function Security Rules / authentication required" on the whole function: the app needs `GET /health` public and the backend already returns 401 without a session.

### Task 5: Load the remaining sample data (only if Task 1 succeeded)
Product items: import `data/sample-import/8-product-items.csv` (24 rows) through the app (Imports -> Product items -> keep "Update the existing record" -> upload -> Import valid rows) or, if you have Data Store bulk import (`catalyst ds:import`), map columns source_record_id, item_type, title, project_code (resolve to project_id by project_code), status, priority, due_date, completed_date, estimated_hours. Prefer the app import (it resolves project codes and sets dedupe keys). It costs about 4 function calls.

### Task 6: Verify with the minimum number of API calls
Make AT MOST 4 calls to the live function, all as the signed-in admin in a browser session if you have one:
1. `GET /diagnostics/schema` (admin only) must return `"ok": true` with no table listing missing columns. This is the authoritative check.
2. Open Delivery -> Product development in the app: the list loads without error.
3. Open Access & Permissions: the yellow "access tables have not been created" banner is gone and "New role" is enabled.
If you have no browser session, skip the calls and verify through the Console only; say so in the report.

## 5. Final report (required format)
1. **Verified target** (account, project id, environment).
2. **Changes made**: a list "table.column added" and "table created", with the exact definitions you used.
3. **Environment variables set** (names only, no secret values).
4. **Authentication findings** (users that exist, User IDs, role ids).
5. **Verification results** for Task 6 (call counts used).
6. **Anything you could not do** and the exact manual steps for the account owner.
Do not claim something works unless you checked it.
    