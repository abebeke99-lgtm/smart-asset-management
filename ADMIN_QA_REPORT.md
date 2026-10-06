# Admin QA Report

Date: 2026-10-06 (Africa/Nairobi)

## Environment and database

| Check | Expected | Observed | Result |
|---|---|---|---|
| Frontend/backend/database stack | React + CRA, Express + Sequelize, MySQL | Confirmed in package manifests and backend database config | PASS |
| Startup | Frontend on 3000, API on 5000, MySQL on 3306 | All three ports accepted connections; React returned 200 and `/api/health` returned `{"status":"ok","database":"connected"}` | PASS |
| Frontend API config | Local CRA proxy to `http://localhost:5000` | `frontend/.env` has no API URL; CRA `proxy` in `frontend/package.json` is used | PASS |
| Database config | Local MySQL, no destructive sync | `DB_HOST=localhost`, `DB_PORT=3306`, `DB_SYNC_ON_START=false`; database authenticated | PASS |
| Schema | Sequelize model tables and mapped columns exist | 85 models, 85 tables, zero missing model tables/columns | PASS |
| Foreign keys | Referenced parent/columns exist | 33 declared FK relationships returned by MySQL metadata; referenced tables and columns are present | PASS |
| Seed users and hashes | Admin and five requested role accounts; passwords hashed | 15 users; bcrypt hashes for every user. Users exist for admin, department_head, finance, store_manager, and infrastructure. `college_manager` exists as the canonical College role; zero accounts use the legacy `college` role string | PARTIAL |
| Role catalog | Requested roles are available | `admin`, `college`, `college_manager`, `department_head`, `finance`, `store_manager`, `infrastructure` exist in the roles catalog | PASS |

The actual local environment is in `.env` files and was checked without printing secret values. Frontend startup: `npm --prefix frontend start`. Backend startup: `npm --prefix backend run dev`. MySQL must be running locally with the configured database. `README.md` documents fresh setup and seed commands. Do not run `seed:user-management` without setting a private seed password.

## Admin API route catalog

The indexed method/path/guard list for **228 mounted Admin route declarations** is in [ADMIN_API_ROUTE_INDEX.md](ADMIN_API_ROUTE_INDEX.md). A successful authenticated request was not available for every route; the route index is static source analysis, not an assertion that all 228 handlers passed runtime tests.

Admin role controls are applied by the route middleware; canonical admin APIs require a bearer JWT for role `admin`. Most successful JSON responses use `{success:true,data:...}` with some routes also returning named aliases such as `users`, `roles`, or `assets`. Invalid input generally returns 400, duplicate records 409, missing records 404, unauthenticated calls 401, and forbidden roles 403.

| Area | Method and URL | Role | Request / response summary |
|---|---|---|---|
| Login | `POST /api/auth/login` | Public, rate limited | JSON username/email and password; success returns JWT and user profile; invalid credentials return an authentication error |
| User list and CRUD | `GET /api/admin/users?search=&status=&role=&collegeId=&page=&limit=`; `GET /api/admin/users/:id`; `POST /api/admin/users`; `PUT /api/admin/users/:id`; `DELETE /api/admin/users/:id` | Admin for canonical namespace | Create/update JSON user fields (`fullName`, `username`, `email`, `role`, optional college/department/status; create also needs `password` and `confirmPassword`). List/detail returns user data; create returns 201; duplicate username/email returns 409 |
| User controls | `GET /api/admin/users/stats`; `GET /api/admin/users/roles`; `PATCH /api/admin/users/:id/status`; `POST /api/admin/users/:id/reset-password`; `POST /api/admin/users/:id/lock`; `POST /api/admin/users/:id/unlock`; `POST /api/admin/users/:id/force-password-change`; `POST /api/admin/users/:id/terminate-session`; `GET /api/admin/users/:id/activity`; `GET /api/admin/users/activity` | Admin | Status JSON; reset password JSON `{password, confirmPassword?}`; responses include updated user/status or activity logs |
| Role permissions | `GET /api/admin/roles`; `GET /api/admin/roles/:role`; `GET /api/admin/permissions`; `GET /api/admin/roles/:role/permissions`; `GET /api/admin/roles/:role/users`; `POST /api/admin/roles`; `PUT /api/admin/roles/:role`; `PATCH /api/admin/roles/:role/status`; `DELETE /api/admin/roles/:role`; `PUT /api/admin/roles/:role/permissions` | Admin with role/permission access | JSON role name/description/status; permission update `{permissions:[...]}`; invalid permissions 400; roles in use cannot be deleted (409) |
| Colleges/departments/assets | `/api/admin/colleges[/:id]` (GET/POST/PUT/PATCH status; export and dashboard GETs); `/api/admin/departments[/:id]` (GET/POST/PUT/DELETE); `/api/admin/assets` (GET and asset management endpoints) | Admin | JSON resource fields; list/detail returns collections/resources; writes return created/updated resource or a validation/conflict error |
| Admin dashboard and analytics | `GET /api/admin/dashboard`; `GET /api/admin/analytics`, `/analytics/assets`, `/analytics/organizations`, `/analytics/maintenance`, `/analytics/assignments`, `/analytics/transfers`, `/analytics/inventory`, `/analytics/rfid`, `/analytics/procurement`, `/analytics/financial`, `/analytics/users`, `/analytics/export`, `/analytics/system/*` | Admin | Optional report filters as query parameters; aggregate/report JSON or CSV export |
| Settings and monitoring | `/api/admin/settings*`, `/api/admin/security/settings*`, `/api/admin/system/health`, `/api/admin/system/integrity`; `/api/admin/monitoring/*` and `/api/admin/system-monitoring/*` | Admin | GET returns settings/health/metrics; PUT accepts settings JSON; alert acknowledge/resolve POSTs; CSV export GET |
| RFID tracking | `/api/admin/rfid/summary`, `/assets`, `/lookup/asset-id/:assetId`, `/lookup/code/:code`, `/assets/:id/tracking`; POST `/scan-log`, `/assets/:id/tags`, `/assets/:id/qr/regenerate` | Admin | Query/tag/scan JSON; returns tracking summaries, matching asset, or changed tags/QR data |
| Notifications, audits, backups | `/api/admin/notifications*`, `/api/admin/audit*`, `/api/admin/backups*` | Admin | GET list/detail/export; POST/PATCH/PUT action payloads; responses acknowledge updates or return generated/verified backup metadata |
| Domain modules mounted below `/api/admin` | Maintenance, disposal, inventory/category, MFA, recovery, ENAM and integrations routes are declared in `adminSupportRoutes`, `chemicalRoutes`, `enamRoutes`, and related route files | Route-specific role/permission middleware; canonical `/api/admin` support mount is admin guarded | See router definitions for per-operation payloads and response types |

Useful safe shell checks (replace the token placeholder only in a private terminal):

```sh
curl -i http://localhost:5000/api/health
curl -i http://localhost:5000/api/admin/dashboard
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/admin/users
curl -i -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"QA User","username":"qa.user","email":"qa@example.test","role":"department_head","password":"Use-A-Private-Test-Value","confirmPassword":"Use-A-Private-Test-Value"}' \
  http://localhost:5000/api/admin/users
```

Do not execute the POST/PUT/PATCH/DELETE examples against the shared local database without an isolated test database and a cleanup plan. The requested create-update-disable-login-delete-report SQL flow was not run because the configured isolated test MySQL at `localhost:3307` refuses connections and the live development database on 3306 contains existing data.

## Results and fixes

| # | Test case | Area | Expected | Observed | Pass/fail | Resolution |
|---:|---|---|---|---|---|---|
| 1 | API/database health | Backend/DB | Connected, HTTP 200 | Connected, HTTP 200 | PASS | None |
| 2 | Admin routes without token | Backend/security | HTTP 401 | `/api/admin/dashboard`, `/api/admin/users`, `/api/users/stats`, and `/api/admin/analytics` returned 401 | PASS | None |
| 3 | DB model/schema comparison | DB | No missing mapped schema | 85/85 tables, 0 missing columns | PASS | None |
| 4 | FK metadata | DB | Valid parent references | 33 FK constraints found | PASS | None |
| 5 | Password storage | DB/security | Password hashes, no plaintext | 15/15 bcrypt hashes | PASS | None |
| 6 | Department user CRUD and direct SQL verification | Frontend/API/DB | Create/update/disable/login/delete reflected in DB | Not executed; no admin test token and isolated DB port 3307 is unavailable | NOT RUN | Start the isolated DB and use disposable QA credentials |
| 7 | Login invalid/valid cases and other-role token | Backend/security | Correct 400/401/403 and token | Not exercised against the live app to avoid failed-login/account mutation and because no disposable credential set was provided | NOT RUN | Run on isolated DB with disposable accounts |
| 8 | CORS rejected origin | Backend/security | Rejected, non-500 response | Before fix it returned 500; error middleware now maps rejected CORS origin to 403. The already-running server was not restarted, so runtime result after change is unverified | FIXED, RERUN NEEDED | Restart backend and verify OPTIONS/request response |
| 9 | Saved role permission revocation | Backend/security | Removed permission stays denied | Previously merged defaults back in; explicit saved matrix now replaces defaults. Targeted security/RBAC tests pass 27/27 | PASS | Fixed in `backend/src/services/rolePermissionService.js` |
| 10 | Admin user management component | Frontend | Role options, field validation, password reset/activity flows | 5/5 component tests pass after aligning fixtures with actual API response and accessible labels | PASS | Validation text now matches backend confirmation wording |
| 11 | Frontend full suite | Frontend | All tests pass | 49 suites passed, 6 failed; 251 passed, 13 failed (264 total). Remaining suites: Help, Contact, DeptReports, AboutUs, Services, DeptStaff | FAIL | Outside the admin user-management checks; remaining failures need individual triage |
| 12 | Backend admin/user/RBAC subset | Backend | Password hash/login, user validation/duplicates, access control, permission revocation | Final combined focused run: 26 passed, 0 failed | PASS | None |
| 13 | Backend full suite | Backend | All tests pass | 502 total, 476 passed, 17 failed, 9 skipped. Four DB-dependent checks cannot connect to configured test MySQL `localhost:3307`; other remaining failures include stale route/source assumptions in role, department, login, seeding, and health tests | FAIL | Provision the isolated test DB; triage remaining test/contract mismatches |
| 14 | Production build | Frontend | Build completes | Build completes with ESLint warnings (unused imports/variables and hook dependency warnings) | PASS | Warnings remain |

Across both full-suite runs: **727 passed, 30 failed, 9 skipped out of 766**. The additional focused suites are reported separately and are not included in this total.

The complete tests were run after the changes. The focused Admin user test was rerun and passes; the full frontend run still has failures in six unrelated page/workflow suites. Full backend failures are retained in the report rather than counted as passing; do not treat DB-unavailable tests as verified.

## Code changes

- `backend/src/services/rolePermissionService.js`: saved permission arrays are now authoritative, so removed permissions cannot be restored by defaults.
- `backend/src/app.js`: rejected CORS origins now carry HTTP 403 rather than falling through to HTTP 500.
- `frontend/src/components/admin/AdminUserManagement.jsx`: password-confirmation validation now matches the API error wording.
- `frontend/src/__tests__/AdminUserManagement.test.jsx`: corrected API fixtures and accessible button names; all five tests now pass.
- `backend/tests/adminUserPasswordCreation.test.js` and `backend/src/tests/collegeManagerRole.test.js`: corrected test fixtures/expectations to cover activity-log stubbing, current login query behavior, required names, and explicit permission revocation.
