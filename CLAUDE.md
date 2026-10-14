# Company 360 (orbit360)

Internal analytics/reporting app on Zoho Catalyst. Project `orbit360` (id 46135000000311001), Development env, timezone Asia/Kolkata.

## Layout
- `functions/orbit_funtion/` - the only backend: Advanced I/O function, `node22`, raw `(req, res)` handler (no Express, no listening server). The folder name is intentionally spelled `orbit_funtion`; do not rename it or add another function.
- `orbit-web/` - React 19 + CRA (`react-scripts` 5), hash routing, JavaScript. Own `.git` repo.
- `data/` - schema source of truth (`database-schema.md`, `company360.schema.json`). 22 Data Store tables already exist. Never recreate tables, rename them or reinitialize Catalyst.

## Commands
- Backend tests: `cd functions/orbit_funtion && npm test` (node:test; runs the real app against an in-memory Catalyst SDK fake in `src/tests/helpers`)
- Frontend tests: `cd orbit-web && CI=true npx react-scripts test --watchAll=false`
- Frontend build: `cd orbit-web && CI=true npm run build` (CI=true makes lint warnings fail)
- Run locally with `catalyst serve` only (needs Node 22 configured: `catalyst config:set node22.bin=<path>`; local Node is 20, so it has not been run here). Never the bare dev server: it lacks `/__catalyst/sdk/init.js`, so auth fails. Serve and test locally before `catalyst deploy --only functions:orbit_funtion -ni`.
- Do not call the bash tool with very large multi-file heredocs; use Write for files.

## Backend (`functions/orbit_funtion`)
Request flow (`src/app.js`): context -> route match -> authenticate -> authorize (builds Scope) -> read body -> validate -> controller -> service -> repository. API base `/server/orbit_funtion/api/v1`; `GET /health` is the only public route.
- `config/`: `environment.js` (env vars, clamped), `constants.js` (limits, roles, completeness values), `datastore.js` (budgeted SDK wrapper), `resources.js` (registry of exposed tables: list columns, team column, filters, writable field specs).
- `routes/` (thin, declarative) -> `controllers/` (HTTP adapters) -> `services/` (business rules) -> `repositories/` (the only place SQL is built). Controllers never touch the database.
- Security boundary: `middleware/authentication.js` maps the Catalyst session to a `users` row (role + team). `services/scope.service.js` `requireScope()` returns a `Scope`; repositories REQUIRE one (`assertScope`) and apply team conditions themselves. Out-of-scope rows return 404 (no IDOR/existence leak). Never accept role/team from the client; team columns are derived server-side (`services/recordRules.js`).
- Cost controls: Data Store is billed per request. `config/datastore.js` enforces a per-request query budget (`QUERY_BUDGET`, imports get more); lists cost 2 queries; dashboard = grouped aggregates only; references are loaded with one `ROWID IN (...)` query per parent table (no N+1); `LIMITS.maxPageSize` 100, trends max 90 days, IN lists chunked at 50. Never page through a whole table.
- Metrics (`services/metrics.service.js`): only approved, non-deleted time entries count, read from `time_entries` alone (never joined to assignments or multiplied by headcount). Every metric has `completeness`: `complete | partial | insufficient_data | not_applicable`; missing data is `null`, never 0. Late status is only the stored `late_status` (no invented cutoff).
- Imports (`services/import.service.js`): job -> preview batches -> resolve conflicts -> commit batches -> complete. Max `IMPORT_BATCH_SIZE` (100) rows per call; the client keeps the file and resends batches. Idempotent via `import_rows` status, unique `dedupe_key`/source ids, and `import_job_id` on target rows. Imported time entries stay `pending`.
- Data Store quirks: ZCQL rows are wrapped under the table name; max 300 rows / 20 columns per SELECT; booleans are the strings `"true"`/`"false"`; strip 4-byte emoji; create rows with `is_deleted: 'false'`. Only validated ids/dates/enums are interpolated into ZCQL (`queryBuilder.lit`).
- Errors/logging: `utils/errors.js` (`ApiError`, `classifyDbError`), `middleware/errorHandler.js`. Logs are structured JSON with `requestId`; `utils/logger.js` redacts personal fields and error messages/stack headers are never logged (they can contain row values).
- Add a table: register it in `config/resources.js`, add a `routes/*.routes.js` using `crudRoutes`, add tests.

## Frontend (orbit-web/src, plain .js, CRA)
- app/ (App, providers: Auth/Theme, routes + guards), components/{layout,navigation,cards,charts,tables,forms,filters,feedback,common}, config/ (navigation, themes, constants, routes, env, features), features/<module>/, hooks/, services/ (apiClient + one service per feature), utils/, styles/{tokens,themes,global,components,layout,controls,settings}.css, tests/.
- Design system: tokens.css (type scale, spacing, motion) + themes.css (exactly 6 themes via [data-theme]: blueberry (default), blackcurrant, volcano, sunset, ocean, forest; old ids light/dark/moon/beach migrate in ThemeProvider and index.html; run `npm run gen:login-css` after color changes, no hardcoded colors in components). Fonts are self-hosted (@fontsource-variable DM Sans + Manrope) with system fallbacks. src/tests/themes.test.js verifies WCAG contrast for every theme: change a color, run it.
- Controls/DnD: use forms/Field + forms/Choice (Checkbox/Radio/Switch); reorderable lists use components/common/SortableList (@dnd-kit; drag handle + keyboard + move buttons). Dashboard widget order/visibility persists per device in localStorage `company360.dashboardLayout` (config/dashboardLayout.js, hooks/useDashboardLayout).
- Spreadsheet editor (`features/spreadsheet/`, route /spreadsheet, third data-entry option next to Add form and Sheet import via DataEntryModes): columns come from GET /imports/templates, data through resourceService (list/create/update/remove); only changed fields are PATCHed, saves are bounded-concurrency with a pre-save field-level conflict check (list has no MODIFIEDTIME), saved values cannot be cleared (API omits blanks), schema is fixed so no add-column. gridModel.js is pure; useSheetData owns edits/undo/save; SheetGrid owns selection/keyboard/clipboard.
- Theme: ThemeProvider persists to localStorage; public/index.html applies it pre-paint (keep ids in sync with config/themes.js).
- Icons: always use `components/common/Icon` with an existing name (never import icon libraries elsewhere). It renders Phosphor icons in the user's chosen style (duotone default; regular/light/bold/solid) or our original "classic" set; style is saved with the theme (`config/icons.js`, Settings -> Appearance). A new icon needs an entry in BOTH the `PHOSPHOR` and `CLASSIC` maps (a test enforces parity).
- Charts are small SVG components (no chart library). KPIs/insights come from backend metrics (/dashboard/*); never compute totals from raw rows in the UI. Missing values render as a dash with a visible reason; completeness (complete/partial/insufficient_data/not_applicable) is shown via CompletenessBadge.
- Module pages are config-driven: features/<x>/ + features/resources/ResourcePage; forms come from GET /imports/templates. Dashboard filters live in the URL (useDashboardFilters). Presentations store sections + rolling period + filters; the player fetches live data as the viewer.
- Route guards and hidden buttons are UX only; the backend enforces access. No tokens in browser storage.
- Visual check: build, then serve build/ with a stubbed Catalyst SDK and drive Chrome with playwright-core (see session notes); catalyst serve was not available locally.

## Known gaps
- Nothing has run against the live Data Store or Catalyst auth. Unverified ZCQL assumptions: `is_deleted = false` (excludes NULLs), GROUP BY alias result shape, `IS NULL`, `OR` in the settings list query, `insertRows` return order.
- Must seed an admin row in `users` before anyone can sign in. Function Security Rules (authentication required) are not configured.
- Import is CSV only (no Excel parser).
- Employee create/import does not maintain `team_memberships`.
- No shared response cache (deliberate: team-scoped data makes it an access-control risk). Request savers that are safe: the `users` row is cached per function instance for `USER_CACHE_SECONDS` (60) keyed by the verified Catalyst id; lists skip the count query on a short page; the frontend `apiClient` keeps a 60s in-memory GET cache cleared by any write, Reload or sign-in.
