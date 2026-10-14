# Sample import data

Fake data for testing the whole app flow (Import → Dashboard → modules → Presentations).
Files are numbered in the order they must be imported, because later files refer to earlier ones by code
(`employee_code`, `project_code`). Dates are September–October 2026.

## Steps (as an administrator)

1. **Teams → Add team** (e.g. code `DEL`, name `Delivery`).
2. **Imports**. For each file 1–8, in order: pick the data type, pick the **Team** (Delivery), keep
   "Update the existing record", choose the file, review, then **Import valid rows**.

| File | Data type | Rows | What it shows |
|---|---|---|---|
| 1-employees.csv | Employees | 12 | Active, on-leave and inactive people |
| 2-projects.csv | Projects | 6 | Active / on hold / completed; one project with no estimate; one with a small estimate |
| 3-project-assignments.csv | Project assignments | 19 | Who works on what |
| 4-time-entries.csv | Time entries | 84 | Billable/non-billable; mostly approved, some pending and rejected |
| 5-attendance.csv | Attendance | 150 | Late, on-time and unknown check-ins |
| 6-leave.csv | Leave | 7 | Approved/requested/rejected; hours vs days; one row with no units |
| 7-ai-usage.csv | AI usage | 21 | Tools across Sep/Oct; one record with no reporting period |
| 8-product-items.csv | Product items | 24 | Tasks/features/bugs, some past due |
| 9-employees-conflicts-and-errors.csv | Employees | 6 | See below |

3. **Dashboard**: set the period to *Custom* `2026-09-14` → `2026-10-31` (or "Last 30 days").
   Expect: partial badges (pending time entries, unknown late status, leave without units), Atlas Platform
   Migration over its estimate, Helios Analytics with no estimate, product items past due, an AI usage
   record excluded for having no period.
4. **Conflicts**: import file 9 with "Ask me for each one". Expect 2 rows that already exist (choose
   *Update* for one and *Keep existing* for the other), 1 new employee, and 3 invalid rows
   (bad date, missing name, status not allowed).
5. **Idempotency**: import any file a second time. Nothing is duplicated.
6. **Presentations → New presentation**: pick sections, a period, save, then **Present**.

## Testing as a manager

Add a `users` row for a second Catalyst account with `app_role` = `manager` and `team_id` = the ROWID of
the team you imported into, sign in with that account, and confirm only that team's data appears.
Importing as a manager needs no team selection: the server uses the manager's team.

Imports never read or write anything outside the chosen team for managers; time entries carry
`approval_status` (`approved` / `pending` / `rejected`) so the dashboard has approved data to show.
