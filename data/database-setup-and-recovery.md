# Database Setup and Recovery

## Status
**Nothing has been created in Catalyst.** These artifacts were generated without access to the repo, CLI or Console. Console steps below are required.

## Pre-flight (run in your repo)
```
catalyst --version
catalyst project:list      # confirm 46135000000311001 / not the MG Motor project
cat .catalystrc            # confirm project binding
ls functions/              # do not overwrite existing
```
Confirm Console URL contains project `46135000000311001` (Development env).

## Create tables (Console > Cloud Scale > Data Store > Create a new Table)
Create in this order so Foreign Key parents exist. Circular refs (users<->employees, users->teams) are broken by creating the table first and adding FK columns in step 2.

Step 1 - create empty tables, scalar columns only:
`teams, employees, users, team_memberships, projects, project_assignments, metric_definitions, import_templates, import_mappings, import_jobs, import_rows, time_entries, attendance_records, leave_records, performance_records, ai_usage_records, product_items, product_item_links, report_snapshots, saved_presentations, audit_logs, application_settings`

Step 2 - add Foreign Key columns after all parents exist (`docs/database-schema.md` marks each `fk`). Set on-delete as listed.

Step 3 - set Mandatory/Unique per the dictionary; enable Search Index only on `employees.full_name`, `projects.project_name`, `product_items.title` if text search is needed.

Step 4 - indexes: add those listed per table only if Console supports them (compound support unverified). Otherwise rely on single-column FK/date indexes and filtered queries.

Step 5 - seed `db/seed/application_settings.json` (settings are PROPOSED values - confirm).

Step 6 - File Store: create folders/buckets `import-sources`, `import-payloads`, `report-artifacts`.

## Verification checklist
- [ ] 22 tables present, no duplicates/typos
- [ ] Column names/types match `company360.schema.json`
- [ ] `users.team_id`, `projects.team_id` FKs point to `teams`
- [ ] Unique: employees.email_normalized, team_code, all `dedupe_key`s
- [ ] Insert 2 test projects/4 assignments/8 time entries (fake data, delete after): totals aggregate without multiplication
- [ ] Insert billable + non-billable entries for one employee; separate sums correct
- [ ] Insert a second `dedupe_key` duplicate -> rejected
Record results in your own log; do not mark verified unless tested.

## Recovery
- Console Data Store supports export; schedule export of all tables before bulk imports or schema edits.
- Soft-deleted rows recover by clearing `is_deleted`.
- Import mistakes: every row carries `import_job_id`; a rollback function can soft-delete rows by job (design in import API phase).
- Schema as code: `company360.schema.json` is the source of truth; record every Console change here (bump `schema_version`).
- Deleting a table/column in Console is irreversible - export first.

## Update for schema 1.1.0 (more_details)
- Use `docs/catalyst-console-checklist.md` (generated) as the authoritative table-by-table creation list. Every table ends with `more_details` (Text, optional, not unique).
- Regenerate everything: `python3 db/build_schema.py` (also validates 22 tables, `more_details` everywhere, <=100 columns, Var Char <=255, FK parents exist).
- Tests: `node --test db/tests/more_details.test.js` and `python3 -m unittest db/tests/test_schema.py`.
- Provisioning status: **no programmatic creation was performed** (no Catalyst CLI in this environment; Catalyst documents Console-only table/column creation and no DDL in ZCQL). Nothing is verified remotely.
- Two v1.0.0 fixes: `projects.consumption_report_url` and `performance_records.evidence_ref` were Var Char(500), above the 255 limit; they are now Text.
- If tables were already created from v1.0.0: add `more_details` (Text) to each, and change the two columns above; do not recreate tables.
