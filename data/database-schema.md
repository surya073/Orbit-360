# Database Schema & Data Dictionary

Generated from `db/schema/company360.schema.json` (do not hand-edit; edit `build.py`/schema JSON).

Every table also has Catalyst system columns `ROWID` (PK), `CREATORID`, `CREATEDTIME` (= created_at), `MODIFIEDTIME` (= updated_at).
`fk` = Foreign Key to parent `ROWID`. Required = Mandatory in Console. Timestamps are not duplicated.

## `teams`

Team master. Scope boundary for manager access.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `team_code` | varchar(60) | Y | Y |  |
| `name` | varchar(150) | Y |  |  |
| `description` | text |  |  |  |
| `is_active` | boolean |  |  |  |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

## `users`

Application-user mapping (Catalyst auth user -> app role + team). users.team_id is single-valued, so a manager cannot belong to two teams.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `catalyst_user_id` | varchar(40) | Y | Y | Catalyst Authentication user ID |
| `email` | varchar(255) | Y | Y | Normalized lowercase |
| `display_name` | varchar(150) |  |  |  |
| `app_role` | varchar(20) | Y |  | admin | manager |
| `team_id` | fk → teams (on delete null) |  |  | Required for manager (server-validated); NULL for admin |
| `employee_id` | fk → employees (on delete null) |  |  | Optional link to employee master |
| `is_active` | boolean |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `app_role, team_id`

## `employees`

Employee identity and employment details. Project counts are derived from project_assignments.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_code` | varchar(60) |  | Y | Business code; source S.NO is NOT used as identity |
| `source_sno` | int |  |  | Source `S.NO` (display order only) |
| `full_name` | varchar(200) | Y |  |  |
| `email_normalized` | varchar(255) |  | Y | lower(trim(Email ID)); unique when present |
| `job_role` | varchar(120) |  |  | Source `Role` |
| `joining_date` | date |  |  |  |
| `reports_to_employee_id` | fk → employees (on delete null) |  |  | Resolved from `Reports To` |
| `reports_to_raw` | varchar(200) |  |  | Unresolved source text kept for review |
| `employment_status` | varchar(30) |  |  | Source `Status`: active|inactive|on_leave|unknown (validated against settings) |
| `primary_team_id` | fk → teams (on delete null) |  |  | Denormalized current team for fast scoping; kept in sync with team_memberships |
| `source_extra` | text |  |  | Bounded JSON of unmapped source columns (<=5 KB) |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `primary_team_id, employment_status`; `source_system, source_record_id`

## `team_memberships`

Employee<->team history. One active row per employee/team enforced via dedupe_key.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `team_id` | fk → teams (on delete cascade) | Y |  |  |
| `employee_id` | fk → employees (on delete cascade) | Y |  |  |
| `membership_role` | varchar(30) |  |  | member|lead |
| `start_date` | date |  |  |  |
| `end_date` | date |  |  |  |
| `is_active` | boolean |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | team_id|employee_id|start_date |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `team_id, employee_id`

## `projects`

Project master. *_reported hour fields are source snapshots; authoritative actuals come from approved time_entries.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `project_code` | varchar(60) |  | Y | Business code if exists |
| `source_sno` | int |  |  | Source `S.NO` |
| `project_name` | varchar(255) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  | Owning team; drives manager scope |
| `project_type` | varchar(80) |  |  | `Type` |
| `plan_type` | varchar(80) |  |  | `Plan Type` |
| `region` | varchar(80) |  |  | `Region` |
| `current_status` | varchar(60) |  |  | Source `Current Status` (col 6): delivery/lifecycle status |
| `contract_status` | varchar(60) |  |  | Source 1st `Status` (after `End Date`): ASSUMED contract/plan validity - CONFIRM |
| `completion_status` | varchar(60) |  |  | Source 2nd `Status` (after `Completed Date`): ASSUMED delivery completion - CONFIRM |
| `meeting_schedule` | varchar(150) |  |  | `Internal Meeting Day and Timing` |
| `second_host_raw` | varchar(200) |  |  | `2nd Host` raw |
| `second_host_employee_id` | fk → employees (on delete null) |  |  |  |
| `first_start_date` | date |  |  |  |
| `current_start_date` | date |  |  |  |
| `end_date` | date |  |  |  |
| `internal_due_date` | date |  |  |  |
| `client_due_date` | date |  |  |  |
| `completed_date` | date |  |  |  |
| `total_renewals` | int |  |  |  |
| `hours_purchased_past` | double |  |  | `Total Hrs Purchased(Past)` |
| `hours_purchased_current` | double |  |  | `Current Hrs Purchased` |
| `hours_used_reported` | double |  |  | `Total Hrs used till now` (snapshot) |
| `estimated_hours` | double |  |  |  |
| `actual_hours_reported` | double |  |  | `Actual Hours` (snapshot) |
| `hours_reconciled` | double |  |  | Cached SUM(approved time_entries)/60; refreshed server-side |
| `hours_reconciled_at` | datetime |  |  |  |
| `comments` | text |  |  |  |
| `delay_reason` | text |  |  | `Client Side /Zoho Side delay reason` |
| `consumption_report_url` | varchar(255) |  |  |  |
| `bandwidth` | varchar(60) |  |  |  |
| `source_extra` | text |  |  | Bounded JSON of unmapped columns |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `team_id, current_status`; `source_system, source_record_id`

## `project_assignments`

Employee<->project. N employees on a project = N rows; hours live in time_entries.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `project_id` | fk → projects (on delete cascade) | Y |  |  |
| `employee_id` | fk → employees (on delete cascade) | Y |  |  |
| `role_in_project` | varchar(120) |  |  | `Role in Project` |
| `is_second_host` | boolean |  |  |  |
| `allocation_percent` | double |  |  | `Bandwidth`/allocation if per-person |
| `contribution_percent_reported` | double |  |  | `% Contribution Towards the Project` (reported, not verified) |
| `is_working` | boolean |  |  | From `Team Members Working` |
| `start_date` | date |  |  |  |
| `end_date` | date |  |  |  |
| `is_active` | boolean |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | project_id|employee_id |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `employee_id`; `project_id`

## `time_entries`

One row per employee per project per work block. Durations in minutes.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_id` | fk → employees (on delete null) | Y |  |  |
| `project_id` | fk → projects (on delete null) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  | Snapshot of project team at entry time; set server-side |
| `work_date` | date | Y |  |  |
| `start_at` | datetime |  |  |  |
| `end_at` | datetime |  |  |  |
| `duration_minutes` | int | Y |  | >=0; zero is a valid value, missing is not stored as 0 |
| `is_billable` | boolean | Y |  |  |
| `work_category` | varchar(60) |  |  | billable|non_billable|internal|support|... |
| `work_description` | text |  |  |  |
| `approval_status` | varchar(20) | Y |  | pending|approved|rejected |
| `approved_by_user_id` | fk → users (on delete null) |  |  |  |
| `approved_at` | datetime |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | source_record_id, else employee|project|work_date|start|duration|hash |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `project_id, work_date`; `employee_id, work_date`; `team_id, work_date, approval_status`

## `attendance_records`

Daily check-in. Source combined column is split into late_status + check_in_time_local.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_id` | fk → employees (on delete null) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `attendance_date` | date | Y |  |  |
| `reporting_month` | varchar(7) |  |  | YYYY-MM |
| `check_in_time_local` | varchar(8) |  |  | HH:mm[:ss] in Asia/Kolkata; empty = not recorded |
| `late_status` | varchar(10) | Y |  | yes|no|unknown (unknown != no) |
| `late_reason` | text |  |  |  |
| `late_checkin_raw` | varchar(120) |  |  | Verbatim `Late Check-in (Yes/No) - Check-In Time` |
| `dedupe_key` | varchar(255) |  | Y | employee_id|attendance_date |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `team_id, attendance_date`; `employee_id, attendance_date`

## `leave_records`

Leave with distinguishable lifecycle status.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_id` | fk → employees (on delete null) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `leave_type` | varchar(60) | Y |  |  |
| `start_date` | date | Y |  |  |
| `end_date` | date | Y |  |  |
| `units` | double |  |  |  |
| `unit_type` | varchar(10) |  |  | days|hours |
| `status` | varchar(20) | Y |  | requested|approved|rejected|cancelled |
| `reason` | text |  |  | Privacy-restricted: admin + owning manager only |
| `approver_user_id` | fk → users (on delete null) |  |  |  |
| `decided_at` | datetime |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | employee_id|leave_type|start_date|end_date |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `employee_id, start_date`; `team_id, status`

## `metric_definitions`

Configured metrics/weights. Aggregate scores may only use rows here.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `metric_code` | varchar(80) | Y | Y |  |
| `name` | varchar(150) | Y |  |  |
| `module` | varchar(40) | Y |  | performance|product|usage|... |
| `value_type` | varchar(20) |  |  | numeric|rating|text|boolean |
| `scale_min` | double |  |  |  |
| `scale_max` | double |  |  |  |
| `weight` | double |  |  | NULL = excluded from aggregates |
| `aggregation` | varchar(20) |  |  | avg|sum|latest |
| `description` | text |  |  |  |
| `is_active` | boolean |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

## `performance_records`

Metric-level performance; no built-in score.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_id` | fk → employees (on delete null) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `review_cycle` | varchar(60) | Y |  |  |
| `period_start` | date | Y |  |  |
| `period_end` | date | Y |  |  |
| `metric_definition_id` | fk → metric_definitions (on delete null) | Y |  |  |
| `metric_value` | double |  |  |  |
| `metric_text` | varchar(255) |  |  |  |
| `metric_scale` | varchar(40) |  |  |  |
| `reviewer_user_id` | fk → users (on delete null) |  |  |  |
| `reviewer_employee_id` | fk → employees (on delete null) |  |  |  |
| `review_status` | varchar(20) | Y |  | draft|submitted|finalized |
| `comments` | text |  |  |  |
| `evidence_ref` | varchar(255) |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | employee_id|review_cycle|metric_definition_id |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `employee_id, review_cycle`; `team_id, period_start`

## `ai_usage_records`

Tool usage as reported. One row per employee x tool (x project) x period.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `employee_id` | fk → employees (on delete null) | Y |  |  |
| `project_id` | fk → projects (on delete null) |  |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `tool_name` | varchar(100) | Y |  | Free text/provider; new tools need no schema change |
| `tool_category` | varchar(30) | Y |  | ai|github|other |
| `access_type` | varchar(60) |  |  |  |
| `is_shared_access` | varchar(10) |  |  | yes|no|unknown |
| `shared_access_raw` | text |  |  | `Users who using other's Access` |
| `usage_percent_reported` | double |  |  | `Percentage % Using` as REPORTED; not billable/productivity |
| `usage_purpose` | text |  |  | `Using for` |
| `projects_raw` | text |  |  | `Used for which Projects` raw |
| `reporting_period` | varchar(20) |  |  | e.g. 2026-10; required when known |
| `dedupe_key` | varchar(255) |  | Y | employee_id|tool_name|project_id|reporting_period |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `employee_id, tool_category`; `team_id, reporting_period`

## `product_items`

Tasks/features/bugs/releases/milestones. Type-specific fields nullable.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `item_type` | varchar(20) | Y |  | task|feature|bug|release|milestone |
| `title` | varchar(255) | Y |  |  |
| `description` | text |  |  |  |
| `project_id` | fk → projects (on delete null) |  |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `status` | varchar(40) |  |  |  |
| `priority` | varchar(20) |  |  |  |
| `assignee_employee_id` | fk → employees (on delete null) |  |  |  |
| `reporter_employee_id` | fk → employees (on delete null) |  |  |  |
| `parent_item_id` | fk → product_items (on delete null) |  |  |  |
| `release_item_id` | fk → product_items (on delete null) |  |  | Release/milestone this item targets |
| `created_on` | date |  |  | Source created date (system CREATEDTIME is import time) |
| `start_date` | date |  |  |  |
| `due_date` | date |  |  |  |
| `completed_date` | date |  |  |  |
| `estimated_hours` | double |  |  |  |
| `actual_hours` | double |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | source_system|source_record_id |
| `source_system` | varchar(60) |  |  | e.g. company360_export, manual |
| `source_record_id` | varchar(120) |  |  | Stable ID from source file/app when present |
| `import_job_id` | fk → import_jobs (on delete null) |  |  | Last import job that wrote this row |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `project_id, item_type, status`; `assignee_employee_id`

## `product_item_links`

Many-to-many item relations (blocks, relates_to, fixed_in).

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `item_id` | fk → product_items (on delete cascade) | Y |  |  |
| `linked_item_id` | fk → product_items (on delete cascade) | Y |  |  |
| `link_type` | varchar(30) | Y |  |  |
| `dedupe_key` | varchar(255) |  | Y | item_id|linked_item_id|link_type |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

## `import_templates`

Per-module reusable templates (system or team-owned).

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `module` | varchar(40) | Y |  |  |
| `name` | varchar(150) | Y |  |  |
| `version` | varchar(20) |  |  |  |
| `file_type` | varchar(10) |  |  | csv|xlsx|both |
| `header_row` | int |  |  | 1-based |
| `team_id` | fk → teams (on delete null) |  |  | NULL = global |
| `is_system` | boolean |  |  |  |
| `is_active` | boolean |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | module|name|version|team_id |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

## `import_mappings`

Source column -> target field with transforms.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `template_id` | fk → import_templates (on delete cascade) | Y |  |  |
| `source_column` | varchar(200) | Y |  | Header text |
| `source_index` | int |  |  | 0-based; disambiguates duplicate headers |
| `target_field` | varchar(100) |  |  | NULL = preserve into source_extra |
| `transform` | varchar(40) |  |  | direct|date|number|boolean|split_yes_no_time|split_list|unpivot|lookup |
| `transform_options` | text |  |  | JSON |
| `is_required` | boolean |  |  |  |
| `sort_order` | int |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `template_id, sort_order`

## `import_jobs`

One row per upload/commit run.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `module` | varchar(40) | Y |  |  |
| `template_id` | fk → import_templates (on delete null) |  |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `file_name` | varchar(255) | Y |  |  |
| `file_type` | varchar(10) |  |  |  |
| `file_store_file_id` | bigint |  |  | Catalyst File Store ID of source file |
| `file_sha256` | varchar(64) |  |  |  |
| `uploaded_by_user_id` | fk → users (on delete null) | Y |  |  |
| `status` | varchar(30) | Y |  | uploaded|mapped|validating|validated|committing|completed|completed_with_errors|failed|cancelled|expired |
| `default_conflict_policy` | varchar(20) |  |  | update|keep_existing|skip|ask |
| `total_rows` | int |  |  |  |
| `valid_rows` | int |  |  |  |
| `invalid_rows` | int |  |  |  |
| `conflict_rows` | int |  |  |  |
| `created_rows` | int |  |  |  |
| `updated_rows` | int |  |  |  |
| `skipped_rows` | int |  |  |  |
| `failed_rows` | int |  |  |  |
| `started_at` | datetime |  |  |  |
| `finished_at` | datetime |  |  |  |
| `error_summary` | text |  |  |  |
| `mapping_snapshot` | text |  |  | JSON of mappings used (bounded) |
| `file_expires_at` | datetime |  |  |  |
| `commit_cursor` | int |  |  | Last committed row_number for safe resume |
| `dedupe_key` | varchar(255) |  |  | team|module|file_sha256 - warns on re-upload |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `team_id, module, status`; `file_sha256`

## `import_rows`

Per-row validation/commit result. NO raw payload; payload lives in File Store (ndjson).

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `import_job_id` | fk → import_jobs (on delete cascade) | Y |  |  |
| `row_number` | int | Y |  |  |
| `status` | varchar(20) | Y |  | valid|invalid|conflict|skipped|committed|failed |
| `business_key` | varchar(255) |  |  | Matching key used (not raw PII where avoidable) |
| `conflict_target_row_id` | bigint |  |  |  |
| `resolution` | varchar(20) |  |  | update|keep_existing|skip |
| `resolved_by_user_id` | fk → users (on delete null) |  |  |  |
| `resolved_at` | datetime |  |  |  |
| `error_codes` | varchar(255) |  |  | Comma list e.g. MISSING_REQUIRED,INVALID_DATE |
| `error_detail` | text |  |  | Field names + reason only, no sensitive values |
| `row_hash` | varchar(64) |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | import_job_id|row_number |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `import_job_id, status`

## `report_snapshots`

Frozen dashboard/report outputs. Retention default 365 days; source records are never deleted by expiry.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `report_type` | varchar(60) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `period_start` | date |  |  |  |
| `period_end` | date |  |  |  |
| `reporting_period` | varchar(20) |  |  |  |
| `parameters` | text |  |  | JSON filters |
| `summary_json` | text |  |  | Small summaries only |
| `data_file_id` | bigint |  |  | File Store ID for large payloads |
| `data_version` | varchar(20) |  |  |  |
| `status` | varchar(20) |  |  |  |
| `generated_by_user_id` | fk → users (on delete null) |  |  |  |
| `generated_at` | datetime |  |  |  |
| `expires_at` | datetime |  |  | generated_at + retention setting |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `report_type, reporting_period, team_id`; `expires_at`

## `saved_presentations`

Full-screen presentation definitions. Visible to all managers of team_id; admins see all.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `title` | varchar(200) | Y |  |  |
| `team_id` | fk → teams (on delete null) |  |  | NULL only for admin-created cross-team decks |
| `created_by_user_id` | fk → users (on delete null) | Y |  |  |
| `slides_config` | text |  |  | JSON; references snapshot IDs |
| `status` | varchar(20) |  |  |  |
| `last_presented_at` | datetime |  |  |  |
| `is_deleted` | boolean |  |  | Soft delete; default false |
| `deleted_at` | datetime |  |  |  |
| `deleted_by_user_id` | fk → users (on delete null) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `team_id`

## `audit_logs`

Append-only. Written server-side only.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `actor_user_id` | fk → users (on delete null) |  |  |  |
| `action` | varchar(40) | Y |  | create|update|delete|import_commit|conflict_resolve|login|... |
| `entity_table` | varchar(60) | Y |  |  |
| `entity_row_id` | bigint |  |  |  |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `import_job_id` | fk → import_jobs (on delete null) |  |  |  |
| `before_json` | text |  |  | Redacted |
| `after_json` | text |  |  | Redacted |
| `reason` | text |  |  |  |
| `request_id` | varchar(60) |  |  |  |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

Recommended compound/extra indexes (verify Console support): `entity_table, entity_row_id`; `actor_user_id`

## `application_settings`

Configuration key/values.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `setting_key` | varchar(100) | Y |  |  |
| `scope` | varchar(10) |  |  | global|team |
| `team_id` | fk → teams (on delete null) |  |  |  |
| `setting_value` | text |  |  |  |
| `value_type` | varchar(20) |  |  |  |
| `description` | text |  |  |  |
| `dedupe_key` | varchar(255) |  | Y | scope|team_id|setting_key |
| `more_details` | text |  |  | Optional. Serialized JSON object of unmapped source columns/extra attributes. Never holds structured fields. Validate: valid JSON object, size cap (confirm Console Text limit) |

## `custom_fields`

Definitions of the extra columns an administrator adds to a record type (spreadsheet today). The values are stored in each record's `more_details` JSON, keyed by `field_key`; this table holds only the definitions. Read by every role with `custom_fields.view` (cached about 10 minutes per function instance); changed only with `custom_fields.create/edit/delete` (administrators by default). Removing a column is a soft delete: values already stored are kept.

| Column | Type | Req | Unique | Notes |
|---|---|---|---|---|
| `module` | varchar(60) | Y |  | Resource name, e.g. `employees`, `projects`, `time_entries` |
| `field_key` | varchar(40) | Y |  | Lowercase letters, digits, underscores; starts with a letter. Key inside `more_details` |
| `label` | varchar(80) | Y |  | Column heading |
| `field_type` | varchar(10) | Y |  | `text` / `number` / `date` / `choice` |
| `choices` | text |  |  | Comma-separated, for `choice` |
| `sort_order` | int |  |  |  |
| `is_active` | boolean |  |  |  |
| `is_deleted` | boolean |  |  | Soft delete; default false |
