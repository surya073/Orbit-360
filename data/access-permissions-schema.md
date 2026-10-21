# Access & Permissions: schema for you to create

**Status: proposed. Nothing in this file has been created.** The application was written so that it works
*before* these tables exist and keeps working after you create them. Create the three tables below in the
Catalyst Console (Data Store), then reload the app. No code change, deploy or data migration is needed.

## What happens before the tables exist

- Everyone keeps the two built-in roles, exactly as before: `admin` (every permission, every team) and
  `manager` (their assigned team, the same abilities the application always gave managers).
- The **Access & Permissions** screen opens in read-only mode and says the tables are missing. Any attempt to
  save returns `409 ACCESS_TABLES_MISSING` with a pointer to this file.
- The function probes the tables at most once a minute per instance, so the missing tables cost one failed
  Data Store call per minute, not per request.

## What stays unchanged

| Existing table | Used for | Change |
|---|---|---|
| `users` | Catalyst identity, `app_role` (`admin`/`manager`), `team_id`, `is_active` | **None.** `app_role` is kept as a safe legacy mirror (see below). |
| `teams` | Team scope boundary | None |
| `audit_logs` | Role and access changes are written here (`entity_table` = `roles`, `role_permissions`, `users`) | None |
| `application_settings` | **Kept.** The reporting structure feature stores its tree here (scope `orgtree`). Only the old *Application settings* screen and its API were removed. | None |

## Relationships

```
teams 1 ──< users >── 1 user_roles >── 1 roles 1 ──< role_permissions
          (team_id)    (user_id)       (role_id)       (role_id)
```

- A user holds **at most one** role (`user_roles.user_id` is unique). A user with no `user_roles` row falls back to
  the built-in role that matches `users.app_role`.
- A role has many permission rows. A permission is `module.action` (for example `employees.edit`). The list of
  valid keys lives in code (`functions/orbit_funtion/src/config/permissions.js`, 52 keys across 16 modules), so
  a new module needs one catalog entry and nothing else; roles are then granted it from the screen.

## Table 1: `roles`

Purpose: a named set of permissions plus the team scope it works with.

| Column | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `role_key` | varchar(40) | Y | **Y** | Lowercase slug, generated from the name (`team_lead`). `admin` and `manager` are the built-in keys. |
| `name` | varchar(100) | Y | | Display name. The app keeps names unique (case-insensitive). |
| `description` | varchar(300) | | | |
| `scope_type` | varchar(12) | Y | | `all_teams` (sees every team) or `own_team` (pinned to the user's `team_id`). Anything else is treated as invalid and the user is denied. |
| `is_system` | boolean | | | `true` for the built-in roles; they cannot be deactivated. |
| `is_active` | boolean | | | Users cannot be given an inactive role; a user holding one is denied. |

System columns `ROWID` (primary key), `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME` exist automatically.
Booleans are stored as the strings `true` / `false`, like every other table.
Suggested index: `role_key` (already unique).

## Table 2: `role_permissions`

Purpose: which permission keys a role holds. One row per role and key. Removing a permission sets
`is_allowed = false` instead of deleting the row (the application never deletes rows; this also lets the screen
show "granted before, then revoked").

| Column | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `role_id` | foreign key → `roles` (`ROWID`) | Y | | On delete: cascade. |
| `permission_key` | varchar(80) | Y | | `module.action`, e.g. `time_entries.approve`. Keys that are not in the code catalog are ignored. |
| `is_allowed` | boolean | | | `true` = granted. `false` or missing = denied (default-deny). |
| `dedupe_key` | varchar(140) | Y | **Y** | `<role_id>\|<permission_key>`. Prevents duplicate rows. |

Suggested index: `role_id` (every lookup is `WHERE role_id = ?`).
Size: at most 52 rows per role, so one SELECT per role stays far below the 300-row ZCQL limit.

## Table 3: `user_roles`

Purpose: the role each person holds.

| Column | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `user_id` | foreign key → `users` (`ROWID`) | Y | **Y** | One role per user. On delete: cascade. |
| `role_id` | foreign key → `roles` (`ROWID`) | Y | | On delete: restrict if the Console allows it (otherwise the app denies a user whose role vanished: `ROLE_MISSING`). |
| `assigned_by_user_id` | foreign key → `users` (`ROWID`) | | | Who made the assignment (also recorded in `audit_logs`). |

Suggested index: `role_id`.

## Table permissions

Create the tables with the same table permissions as your existing tables. The function reads and writes with the
admin-scope SDK, the same way it does for `users`, `employees` and the rest. No App User access is needed, and
none should be granted: these tables decide who can do what.

## Default roles and seed data

**Seeding is optional.** Without any rows the built-in defaults apply:

- `admin` always holds all 52 permissions. Even if you create an `admin` row, its stored permissions are
  ignored, so the Administrator can never be edited or locked out.
- `manager` holds the 47 permissions below. The first time an administrator edits the Manager role on the
  Access screen, the application stores a `manager` row and its permission rows (copied from these defaults)
  and applies the change.

If you prefer to seed by hand, insert:

| `roles.role_key` | `name` | `scope_type` | `is_system` | `is_active` |
|---|---|---|---|---|
| `admin` | Administrator | `all_teams` | `true` | `true` |
| `manager` | Manager | `own_team` | `true` | `true` |

and for `manager` one `role_permissions` row (`is_allowed = true`, `dedupe_key = <manager ROWID>|<key>`) per key in the
"Manager default" column below. The `admin` role needs no permission rows.

### Permission catalog (current code)

| Module | Key prefix | Group | Actions | Manager default |
|---|---|---|---|---|
| Dashboard | `dashboard` | Overview | view, export | view, export |
| Employees | `employees` | People | view, create, edit, delete | view, create, edit, delete |
| Reporting structure | `reporting` | People | view, edit | view, edit |
| Teams | `teams` | People | view, create, edit | view |
| Attendance | `attendance` | People | view, create, edit, delete | view, create, edit, delete |
| Leave | `leave` | People | view, create, edit, delete | view, create, edit, delete |
| Performance | `performance` | People | view | view |
| Projects | `projects` | Delivery | view, create, edit, delete | view, create, edit, delete |
| Project assignments | `assignments` | Delivery | view, create, edit, delete | view, create, edit, delete |
| Time entries | `time_entries` | Delivery | view, create, edit, delete, approve | view, create, edit, delete, approve |
| Product development | `product` | Delivery | view, create, edit, delete | view, create, edit, delete |
| AI & GitHub usage | `ai_usage` | Delivery | view, create, edit, delete | view, create, edit, delete |
| Imports | `imports` | Data | view, create | view, create |
| Spreadsheet | `spreadsheet` | Data | view, export | view, export |
| Presentations | `presentations` | Data | view, create, edit, delete | view, create, edit, delete |
| Access & Permissions | `access` | Administration | view, manage_roles, manage_users | none |

Notes on specific permissions:

- **Imports:** an import needs `imports.create` *and* `<target module>.create` (and `.edit` when the import may
  overwrite existing rows).
- **Spreadsheet:** the page needs `spreadsheet.view`; changing records also needs `Create` / `Edit` / `Delete`
  on the record's own module. `spreadsheet.export` hides the CSV download button. Export is generated in the
  browser from data the user can already see, so it is a UI permission only.
- **Dashboard export:** creating a saved report snapshot (`POST /dashboard/snapshots`).
- **Reporting structure / per-person dashboard data** also need `employees.view`, because they list people.

### Legacy mirror in `users.app_role`

When an administrator assigns a role, the app keeps `users.app_role` consistent: the protected Administrator role
sets `admin`, every other role sets `manager`. It is deliberately **never** `admin` for a custom role, so if
`user_roles` rows were ever lost, nobody silently becomes an Administrator: they fall back to a one-team
manager (and are denied outright if they have no team).

## Reference DDL (informational only)

Catalyst Data Store is configured in the Console, not with SQL. This is the same design in SQL terms:

```sql
CREATE TABLE roles (
  ROWID           BIGINT PRIMARY KEY,           -- Catalyst system column
  role_key        VARCHAR(40)  NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  description     VARCHAR(300),
  scope_type      VARCHAR(12)  NOT NULL,        -- 'all_teams' | 'own_team'
  is_system       BOOLEAN,
  is_active       BOOLEAN
);

CREATE TABLE role_permissions (
  ROWID           BIGINT PRIMARY KEY,
  role_id         BIGINT       NOT NULL REFERENCES roles(ROWID) ON DELETE CASCADE,
  permission_key  VARCHAR(80)  NOT NULL,
  is_allowed      BOOLEAN,
  dedupe_key      VARCHAR(140) NOT NULL UNIQUE  -- role_id|permission_key
);
CREATE INDEX ix_role_permissions_role ON role_permissions(role_id);

CREATE TABLE user_roles (
  ROWID               BIGINT PRIMARY KEY,
  user_id             BIGINT NOT NULL UNIQUE REFERENCES users(ROWID) ON DELETE CASCADE,
  role_id             BIGINT NOT NULL REFERENCES roles(ROWID),
  assigned_by_user_id BIGINT REFERENCES users(ROWID)
);
CREATE INDEX ix_user_roles_role ON user_roles(role_id);
```

## After you create the tables

1. Reload the app and open **Access** → **Overview**. The setup warning disappears.
2. Open **Roles & permissions**. Built-in roles show "using built-in defaults" until the first edit.
3. Open **Users** and assign roles. A user without an assignment keeps their built-in role.
4. Check `audit_logs` for entries with `entity_table` of `roles`, `role_permissions` or `users`.

## Behaviour you should know about

- **Changes take effect immediately** on the function instance that handled the change, and within
  `USER_CACHE_SECONDS` (default 60) on other instances and already-open sessions. Set it to `0` to disable the
  per-instance caches if you need instant propagation (it costs a few extra Data Store reads per request).
- **Request cost:** with the tables present, resolving a user's access costs up to 3 Data Store reads per
  instance per minute per user (assignment, role, permissions), then none until the cache expires.
- **Permissions are grants only.** There are no per-person exceptions and no explicit "deny" that overrides a
  grant: anything not granted is denied. The screen shows "granted", "not granted" and "granted before, then
  revoked".
- **Safety rules enforced by the server:** the Administrator role cannot be edited or deactivated; only an
  Administrator can change an Administrator; nobody can change their own access; nobody can grant a permission
  or a team scope they do not hold; a role with users cannot be deactivated; the last active Administrator
  cannot be demoted or deactivated; an own-team role needs a team.
- **Adding people:** users are still provisioned in Catalyst Authentication and in the `users` table as before.
  The Access screen manages the role, team and active flag of existing users; it does not send invitations.

## Table 4 (optional): `user_permissions`

Purpose: what ONE person may do beyond, or less than, their role. Effective permissions = the role's permissions
plus every `allow` row, minus every `deny` row. The protected Administrator role ignores these rows. Until this
table exists everything works on roles alone, and saving an individual permission answers
`409 ACCESS_TABLES_MISSING`.

| Column | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `user_id` | foreign key → `users` (`ROWID`) | Y | | On delete: cascade. |
| `permission_key` | varchar(80) | Y | | `module.action`, e.g. `employees.delete`. |
| `effect` | varchar(10) | Y | | `allow`, `deny`, or `inherit` (a cleared override; rows are never deleted). |
| `dedupe_key` | varchar(140) | Y | **Y** | `<user_id>\|<permission_key>`. |

Suggested index: `user_id`. Rules (enforced by the server): nobody changes their own access, nobody grants a
permission they do not hold themselves, an Administrator's access cannot be overridden, a team-scoped manager only
reaches users of their own team.

## Inviting people (Catalyst Authentication)

`POST /access/invitations` (needs `access.manage_users`) takes first name, last name, email, a role (and a team for
roles that cover one team). The function calls Catalyst's `userManagement().registerUser(...)`, which adds the person
and emails them a link to set their password; it then creates their `users` row and `user_roles` row, so their role
and team are in place when they first sign in through the embedded login. The Catalyst id returned by the invitation
is stored in `users.catalyst_user_id`.

Optional function environment variables:

| Variable | Meaning |
|---|---|
| `CATALYST_APP_ROLE_ID` | The Catalyst Authentication role (Console → Authentication → Roles, e.g. "App User") given to invited people. |
| `INVITE_REDIRECT_URL` | Where the person lands after setting their password. Defaults to Catalyst's own. |
| `INVITE_SENDER_EMAIL` | When set, the invitation uses our own subject and wording from this sender (the sender must be allowed in Catalyst Mail settings). Otherwise Catalyst's default template is used. |

Unverified against live Catalyst (nothing has run there): the exact `registerUser` behaviour in your project, the
email delivery, and that development allows at most 25 invited users.
