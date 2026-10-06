# Department Head QA Report

**Acceptance source:** `Department_Head_Module_Documentation.docx` (functional specification, not overriding user instructions). Scope: Department Head module only. The user-request attachment requires safe investigation and fixes; the shared database must not be destructively changed.

**Final verdict: NOT PRODUCTION READY.** Department Head code regressions in scope were fixed and isolated tests pass. The shared database still has unknown orphaned assignment history requiring business review. Authenticated HTTP/browser E2E, responsive browser checks and end-to-end SQL/API parity were not verified because no approved Department Head credentials or browser session were available.

**Important test-safety correction:** During the current session, the backend full suite was run once without `NODE_ENV=test`; this does not select the configured isolated test database and may have used the normal configured database. A read-only lookup found 291 audit rows matching the audit-context test fixture signature, but there was no pre-run count to attribute these rows to this run. No matching rows were deleted. Treat their provenance as unverified and review before any cleanup. The current session's explicit `NODE_ENV=test` run failed because the configured test database refused the connection.

## Test summary

| Test scope | Result | Actual |
|---|---|---|
| Department Head baseline backend | PASS | 89 passed |
| Department Head baseline frontend | PASS | 79 passed |
| Post-fix integrity regression suites | PASS | 32 passed, 0 failed: transfer scope, asset retention/permanent-delete protection, service request scope, user deletion integrity |
| Full backend | PASS | Latest full run on the isolated `smart_asset_backend_test_20261006` schema: 514 tests, 505 passed, 0 failed, 9 skipped. |
| Full frontend | FAIL | Latest CI-mode run: 55 suites, 52 passed and 3 failed; 264 tests, 259 passed and 5 failed. Failures are in public Help, AboutUs and Services tests. |
| Production build | PASS with warnings | Latest production build succeeded; existing ESLint and large bundle warnings remain. |

## Environment and database audit

- Frontend: React 18, React Router, CRACO (port 3000). Backend: Node.js 22, Express 4, Sequelize (port 5000). Database: MySQL via `mysql2`.
- Backend DB config is in `backend/.env`; template `backend/.env.example`. Frontend API base is `REACT_APP_API_URL`; CRA proxy points at `http://localhost:5000`.
- At the time of the earlier audit snapshot, a shared local DB read-only connection to MySQL `localhost:3306` succeeded. The configured test DB `localhost:3307` refused connection. A separate `smart_asset_department_qa_20261006` schema was used for constraint testing. The test-safety correction above supersedes the prior statement that the shared DB was only read for the entire task.
- 85 tables; model/table column comparison found no missing model columns. Shared DB had 33 FK constraints. Password values were checked in aggregate only: all 14 matched bcrypt `$2...` format. No hashes or credentials were exposed. No approved Department Head password was supplied; login was not attempted.
- Shared DB counts: 7 departments, 14 users, 25 assets (one soft-deleted row retained physically), 0 rooms, 157 assignments, 0 department asset requests, 0 request histories, 0 department verifications, 2 verification sessions, 0 service requests and 0 request status histories. Laboratories are `rooms` with `room_type=laboratory`; no separate laboratories table.
- FK dry-run checks 45 Department Head relations. Shared DB: 9 already present, 31 ready, and 5 blocked by orphan rows: `departments.head_id` (1), `assignments.asset_id` (150), `assignments.assigned_to` (2), `assignments.assigned_by` (2), `approvals.requested_by` (2). Dry-run did not alter schema. The 150 missing assets have no corresponding physical row; audit logs show only two unrelated soft-delete actions and no permanent-delete evidence. Two assignment records reference a missing user. All remain **UNKNOWN — REQUIRES REVIEW**; no asset/user was recreated or deleted. Detailed sanitized rows: `DEPARTMENT_HEAD_ASSIGNMENT_ORPHANS.csv`; read-only SQL: `backend/database/diagnostics/department_head_assignment_orphans.sql`.
- Isolated schema migration applied all 45 constraints successfully. Startup now applies these constraints only after syncing a newly created empty database. Existing databases are not automatically changed.

## Findings fixed

1. Assignment transfer validation now rejects recipient users outside the authenticated Department Head department, recipients without a department, and target laboratories outside the department.
2. Asset retention purge skips assets with linked records; explicit permanent delete returns 409 when historical associations exist.
3. User deletion checks every non-audit/activity Sequelize user association and returns 409 when business records reference the account.
4. Fresh empty database sync now installs Department Head foreign keys after creating tables. Migration default is read-only dry-run; applying requires explicit `--apply` and only clean relations are added.

Changed code includes `backend/src/routes/assignmentRoutes.js`, `backend/src/controllers/userController.js`, `backend/src/services/userReferenceService.js`, `backend/src/services/assetReferenceService.js`, `backend/src/services/assetRetentionService.js`, `backend/src/controllers/assetExtendedController.js`, `backend/src/config/sync.js`, and regression tests in `backend/src/tests/departmentAssignments.test.js`, `backend/src/tests/scopedAssetAccess.test.js`, and `backend/src/tests/userDeletionIntegrity.test.js`.

## QA matrix

| # | Test case | Layer | Expected | Actual | Status | Resolution / limitation |
|---:|---|---|---|---|---|---|
| 1 | Environment and DB connection | DB | Backend reaches configured DB | Shared DB reachable on :3306; configured test DB :3307 refuses | PARTIAL | Separate isolated schema used for safe FK tests |
| 2 | Schema/model columns | DB | Required model tables/columns exist | 85 tables; no model-column gaps | PASS | None |
| 3 | Shared DB FK integrity | DB | Relationships enforced, no orphans | 5 FK relationships blocked; assignment orphan refs above | FAIL | Unknown historical rows require business review; no unsafe repair |
| 4 | Isolated FK installation | DB | Clean schema receives FK constraints | 45/45 added successfully | PASS | Verified only on isolated schema |
| 5 | Department Head login/token | Backend | Valid login issues session; invalid input denied | No approved test password; not attempted | UNVERIFIED | Provide approved isolated test account to run HTTP auth matrix |
| 6 | Anonymous/wrong-role route access | Backend | 401/403 | Unit route/scope tests cover guards; live authenticated/anonymous HTTP matrix not run | PARTIAL | Run with approved test account and running API |
| 7 | Cross-department service requests | Backend | Foreign records inaccessible | Focused tests pass | PASS (automated) | Live API tampering not run |
| 8 | Assignment transfer recipient/lab scope | Backend | Reject other department or unscoped user/lab | Both regressions pass | PASS | Fixed transfer validation |
| 9 | Asset purge/permanent delete with history | Backend/DB | Preserve historical references | Regression cases pass; explicit API delete returns 409 | PASS (automated) | Shared orphan rows left untouched |
| 10 | Referenced user deletion | Backend/DB | Reject deletion when operational references exist | Association-based regression passes | PASS (automated) | Audit/activity rows intentionally non-blocking |
| 11 | Create/update/deactivate/delete user end-to-end | Frontend/API/DB | UI→API→DB state agrees at every step | No approved login/session; not run | UNVERIFIED | Requires isolated E2E fixture and account |
| 12 | Dashboard/report SQL/API count parity | Frontend/API/DB | Counts agree | No authenticated representative session/data | UNVERIFIED | Must compare API output with SQL on isolated fixtures |
| 13 | UI forms/search/filter/loading/error/mobile | Frontend | All controls/validation/responsive behavior work | Focused frontend baseline passes; no responsive browser run | PARTIAL | Browser visual QA remains |
| 14 | Full backend regression | Backend | All tests pass | Latest isolated-schema run: 505 passed, 0 failed, 9 skipped (514 total) | PASS | Test database only; shared DB unchanged |
| 15 | Full frontend regression | Frontend | All tests pass | Latest CI-mode run: 52/55 suites pass; 259/264 tests pass, 5 fail in Help, AboutUs and Services | FAIL | Public-page copy/heading/link expectations remain unresolved and are outside Department Head module scope |
| 16 | Production build | Frontend | Build completes | Latest build succeeded with ESLint and bundle-size warnings | PASS WITH WARNINGS | Clean warnings/bundle size separately |

## Final totals and remaining work

- Post-fix integrity regression run: **32 passed, 0 failed**.
- Latest full backend: **505 passed, 0 failed, 9 skipped** (514 total) on the isolated test schema. Earlier `spawn EPERM` was resolved by invoking Node's test runner directly and sequentially.
- Latest full frontend: **259 passed, 5 failed** (264 total; 52/55 suites passed). The remaining failures are in public Help (3), AboutUs (1), and Services (1) tests. They are not Department Head workflows.
- Shared DB was only read. Isolated schema received the FK migration. Unknown historical assignment references remain unchanged and need source-record/business review before any repair.
- Do not treat the module as production-ready until orphan records are reviewed, shared-database migration is planned, frontend failures are resolved, and approved-credential HTTP/browser E2E and responsive checks pass.

## Latest verification update

- The complete backend regression suite now runs successfully against `smart_asset_backend_test_20261006`: **514 tests, 505 passed, 0 failed, 9 skipped**. The separate test schema is isolated from `smart_asset_db`; no application/shared-schema data was changed.
- The complete frontend regression was rerun in CI mode to avoid changed-file filtering: **55 suites, 52 passed, 3 failed; 264 tests, 259 passed, 5 failed**. The failures are 3 Help-page tests, 1 AboutUs test, and 1 Services test, all around public-page headings/copy/links and outside the Department Head module.
- The frontend production build succeeds with warnings. No production-readiness claim is made based on build success alone.
- The shared-database foreign-key migration remains a read-only dry run: of 45 Department Head relationships, 9 are already present, 31 are ready, and 5 are blocked by orphan references. Do not apply the blocked constraints.
- The orphan snapshot remains **152 rows**: 150 missing asset references and 2 assignment rows referencing missing users. Every row remains **UNKNOWN — REQUIRES REVIEW**. No orphan was repaired, deleted, or recreated.
- Cleanup is **PENDING BUSINESS/DATA OWNER APPROVAL**. Preserve the assignment and transfer history. Before any cleanup, the data owner must identify authoritative source records, approve a row-by-row disposition and retention treatment, and authorize a backed-up, reviewed migration with a rollback plan.
- Approved Department Head QA credentials remain unavailable. Authenticated HTTP/E2E, responsive browser QA, and SQL/API parity therefore remain unverified. No credentials were invented or used against the shared database.

**Current verdict: NOT PRODUCTION READY.** The remaining blockers are unresolved shared-database orphans and blocked foreign keys, failed full frontend public-page tests, and unverified authenticated/browser/parity gates.

## Current session addendum (2026-10-06)

This addendum supersedes earlier test totals where they differ. It records the additional verification performed for the supplied acceptance prompt. No authenticated QA is claimed. The default-mode backend test run may have written audit-context fixture rows as described above; no cleanup was attempted.

### Changes made

1. `backend/src/middlewares/organizationScope.js`: Department Head requests now fail closed if their authenticated account has no valid active `departmentId`. Request-time authorization no longer guesses a department from a text name, creates a department, or updates the user record.
2. `backend/tests/departmentDashboard.test.js`: regression tests cover missing and nonexistent department IDs and assert authorization performs no writes.
3. `frontend/src/components/department/DeptReports.jsx`: Excel/PDF export actions are hidden and guarded by `reports.export`; regular report errors now identify reports rather than inventory.
4. `frontend/src/components/department/DeptReports.test.jsx`: report loading, export permission, error, inventory loading, and empty-state cases are covered.
5. `frontend/src/App.jsx`: the public path list used by the app navigation effect is now module-scoped, fixing the observed `publicPaths is not defined` runtime exception.

### Current validation results

| Area | Status | Evidence | Remaining Risk |
|---|---|---|---|
| Department Head backend focused tests | PASS | `node --test --test-concurrency=1` over `backend/tests/department*.test.js` and `backend/src/tests/department*.test.js`: 76 passed, 0 failed | Unit tests do not substitute for authenticated live API checks |
| Department Head reports tests | PASS | `CI=true npx craco test --runInBand --watchAll=false --runTestsByPath src/components/department/DeptReports.test.jsx`: 7 passed, 0 failed | No authenticated browser export run |
| Full frontend suite | FAIL | `CI=true npm --prefix frontend test -- --watchAll=false`: 55 suites; 54 passed, 1 failed; 267 tests; 266 passed, 1 failed. The failure is `AdminRolesPermissions.test.jsx`, outside this module | Existing unrelated test failure remains |
| Frontend production build | PASS WITH WARNINGS | `npm --prefix frontend run build` completed; output reports compiled with warnings and the build directory is ready | Existing ESLint/deprecation/bundle warnings remain |
| Backend full suite, isolated test mode | FAIL / BLOCKED | `NODE_ENV=test npm test` in `backend`: 516 tests; 502 passed, 5 failed, 9 skipped. Database-dependent tests report connection refused at configured test DB `127.0.0.1:3307` | Full backend result is not a valid green isolated-database run |
| Backend full suite, default mode | NOT COUNTED AS SAFE PASS | `npm test` completed 516 tests (507 passed, 0 failed, 9 skipped), but `NODE_ENV=test` was not set and the configured test DB was unavailable | This run may have used the normal configured database. A read-only lookup found 291 audit rows matching the audit-context test fixture signature; without a pre-run count, their creation cannot be attributed. No rows were deleted. Review before any cleanup |
| Department Head FK audit | PASS (READ-ONLY) | `departmentHeadForeignKeys.js` dry-run: 45 relations; 9 present, 31 ready, 5 blocked by orphans | Do not apply blocked constraints; preserve unresolved history pending owner review |
| Unauthenticated department API | PASS | `GET /api/department/dashboard` and `GET /api/department/reports?reportType=assets` returned HTTP 401 | Authenticated role/scope cases remain unverified over HTTP |
| Browser runtime | PARTIAL | Direct dashboard navigation redirected to `/login`; reload produced no page errors | No approved Department Head session was available; module pages, networks, filters, exports, and responsive breakpoints were not tested |

### Data-integrity and QA limitations

- No users, assets, or departments were deleted, recreated, or repaired. The FK check was dry-run only. The default-mode backend test run may have added audit-context fixture rows; their provenance is unverified and they were left untouched.
- Existing orphan findings remain: 150 assignment references to missing assets, 2 assignments referencing missing users, 1 department head reference to a missing user, and 2 approval requester references to missing users. These require owner review; this session did not inspect or alter individual records.
- The application’s live configured test database at port 3307 was unavailable. Do not treat default-mode full backend tests as isolated verification. The fixture-signature audit rows are retained; no cleanup was attempted.
- No approved Department Head QA credentials or authenticated browser session were supplied. Do not invent credentials or bypass authentication.
- Dashboard/report SQL parity, authorized 200 responses, forbidden 403 cases via live API, mutations, duplicate requests, network-tab checks, and 1440/768/375px responsive browser checks remain unverified.

**Current final decision: NOT PRODUCTION READY.** Authenticated QA, safe full-backend test execution, the unrelated failing frontend test, unresolved database orphans/foreign keys, and responsive/API parity verification remain blockers.
