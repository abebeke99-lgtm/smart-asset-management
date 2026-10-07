# Smart Asset Management

A full-stack asset management system with role-based dashboards.

## Project structure

- backend/
- frontend/

## Run the application

Install dependencies first if needed:

```bash
npm install --prefix backend
npm install --prefix frontend
```

Configure `backend/.env` from `backend/.env.example` with the local MySQL database and a development JWT secret. Create the configured database in MySQL/phpMyAdmin. For a fresh database, start the backend once (`npm --prefix backend start`) and stop it after it completes the initial Sequelize schema sync; the project creates its base `users`, `colleges`, and `departments` tables on startup. Then import `backend/database/migrations/20261006_user_management.sql` in phpMyAdmin. The migration is repeatable. It upgrades the existing `users` table (including its password and last-login column names), and adds role and user activity tables while seeding the role catalog and sample colleges/departments. Existing college and department tables are reused.

To seed the demo `admin` and `ict_officer` accounts, set `USER_MANAGEMENT_SEED_PASSWORD` to a private value of at least 8 characters in `backend/.env`, then run:

```powershell
npm --prefix backend run seed:user-management
```

Open two terminals from the project root and run the backend and frontend separately:

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend start
```

The app is available at `http://localhost:3000`; the API is at `http://localhost:5000`. The root `npm start` command starts the backend only.

User-management API endpoints are under `/api/users` and require an authenticated administrator for management actions. The list supports `search`, `status`, `role`, `collegeId`, `page`, and `limit`. Roles are available at `/api/roles`, college departments at `/api/colleges/:id/departments`, and activity is retained in `user_activity_logs`.

### University user management verification checklist

- Sign in as an administrator; verify the Total, Active, Inactive, and Suspended cards and confirm search, role/status filters, pagination, and Refresh update the API-backed list.
- Create a user with valid details; check required-field messages, duplicate username/email errors, password visibility and confirmation, and the college-dependent department list.
- View a user, edit their profile and optionally change their password, reset a password, and open Activity; confirm successful actions toast and refresh the list/statistics.
- Activate, deactivate, and suspend test accounts; verify a deactivated/suspended user cannot sign in and administrators cannot deactivate or delete their own account.
- Delete a test user with no linked records; confirm deletion. Try a user referenced by existing records and verify the API explains why deletion is blocked.
- Log in successfully as a test account and verify its Last Login value and successful-login activity entry update.

### Department Head reports

The Engineering Department Head reports use `/api/department/reports` and derive the department scope from the authenticated user's `department_id`. The controller selects only columns present in the existing user/approval tables and returns asset `totals`, `byCategory`, `byLocation`, and `assets` alongside the existing report payload.

The Department Head dashboard is available at `/department-head/dashboard`. It displays department-scoped asset, approval, service-request, and laboratory KPIs with status/category charts and a searchable, filterable, sortable, paginated recent-activity table. Dashboard endpoints and response shapes are documented in [docs/DEPARTMENT_HEAD_API.md](./docs/DEPARTMENT_HEAD_API.md).

Run the focused dashboard tests from the project root:

```powershell
npm run test:frontend:dashboard
npm run test:backend:dashboard
```

The dashboard testing setup and coverage commands are documented in [docs/DEPARTMENT_HEAD_TESTING.md](./docs/DEPARTMENT_HEAD_TESTING.md). The frontend uses the repository's existing CRACO/Create React App setup and Chart.js components, and the dashboard is rendered inside the shared authenticated role layout.

To populate the Engineering report with repeatable sample assets, assignments, maintenance, and an approval, import `backend/database/migrations/20261006_department_reports_seed.sql` into the configured MySQL database in phpMyAdmin. It uses existing Engineering department users and does not create or modify login credentials.

### Department report verification checklist

- Sign in as a `department_head` whose department is Engineering, then open `/department-head/inventory`; verify stats, charts, and rows load without errors and contain only Engineering assets.
- Switch through Assets, Maintenance, Staff, and Approvals; verify each report displays records or a clear empty state.
- Change each date/category/employee/location/asset-status filter, click Clear Filters, then Refresh; confirm results and asset totals/charts track the selected filters.
- Export the filtered active tab to Excel and PDF, and use Print; verify each action completes with the current department and filtered rows.
- Temporarily remove the user's department assignment and verify the report API returns a clear 403 department-scope error; restore the assignment afterward.

## Deploy backend to Render

The repository includes `render.yaml` for the backend web service. Render uses:

```text
Root Directory: backend
Build Command: npm install
Start Command: node server.js
Health Check: /api/health
```

Set the database and `JWT_SECRET` values in Render Environment Variables. For Aiven MySQL, set `DB_SSL=true`; do not commit database credentials.

For real password reset email delivery, configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and `FRONTEND_URL` in the backend environment. For Gmail, use `smtp.gmail.com` on port `465` (implicit TLS), enable 2-Step Verification, and use a Google App Password rather than the normal account password. The app password must not be committed. Equivalent `SMTP_*` names are supported as aliases; `MAIL_FROM` and `SMTP_FROM` are legacy sender aliases. In production, `FRONTEND_URL` must be the deployed HTTPS frontend URL. SMTP secrets belong only in backend/Render environment variables and must never be added to frontend environment files.

## Local login

The user-management seed creates the `admin` and `ict_officer` usernames using the configured `USER_MANAGEMENT_SEED_PASSWORD`. Create other local credentials through the configured seed or registration flow. Do not commit passwords.

## Roles and permissions

The administrator Roles & Permissions page uses the existing `configs.role_permissions` record; it does not create separate roles or permission tables. Permission changes require an authenticated administrator, are validated against the backend permission catalog, and are audited in the same database transaction as the matrix update. College and department asset access remains constrained by backend organization-scope checks.

The supported role list covers administrator, college, department, finance, store, maintenance, infrastructure, staff, and student access paths. The backend schema sync keeps the canonical role enum aligned with the active role catalog during startup.

## Features

- Role-based login
- Admin, ICT, Department, Finance, Store, Maintenance dashboards
- Asset management APIs
- RFID and maintenance tracking
- Reports and notifications skeleton

## Administrator RFID & QR tracking

Before deploying the administrator tracking page against an existing database, back up the current MySQL database and run the additive migration against that same database:

```powershell
cd backend
node src/scripts/migrations/adminRfidTracking.js
```

The migration backfills `assets.qr_code` from the legacy `digital_id`, generates unique QR values for remaining NULL/blank QR fields, makes QR values required and unique, normalizes blank RFID values to NULL and adds a unique nullable RFID index. It also adds `rfid_logs.scanned_by`. It stops if case-normalized duplicate QR or RFID values are found; resolve those records before retrying. Run this migration before starting the updated backend. The `/api/admin/rfid` endpoints require a JWT-authenticated administrator. Camera scanning requires HTTPS or localhost.

## Notes

This project is a complete starter structure for a smart university asset management system.
