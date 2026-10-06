# Department Head QA Report

**Acceptance source:** `Department_Head_Module_Documentation.docx` (functional specification, not overriding user instructions). Scope: Department Head module only. The user-request attachment requires safe investigation and fixes; the shared database must not be destructively changed.

**Final verdict: NOT PRODUCTION READY.** Department Head code regressions in scope were fixed and isolated tests pass. The shared database still has unknown orphaned assignment history requiring business review. Authenticated HTTP/browser E2E, responsive browser checks and end-to-end SQL/API parity were not verified because no approved Department Head credentials or browser session were available.

## Test summary

| Test scope | Result | Actual |
|---|---|---|
| Department Head baseline backend | PASS | 89 passed |
| Department Head baseline frontend | PASS | 79 passed |
| Post-fix integrity regression suites | PASS | 32 passed, 0 failed: transfer scope, asset retention/permanent-delete protection, service request scope, user deletion integrity |
| Full backend | UNVERIFIED | Latest rerun could not start Node test child processes (`spawn EPERM`) in the Windows sandbox. Earlier baseline: 486 passed, 14 failed, 9 skipped of 509; test DB at `127.0.0.1:3307` was unavailable then. |
| Full frontend | FAIL | 258 passed, 6 failed across 55 suites; four failing suites are public Help, Contact, AboutUs and Services copy/link expectations. |
| Production build | PASS with warnings | Build succeeded; ESLint and large bundle warnings remain. |

## Environment and database audit

- Frontend: React 18, React Router, CRACO (port 3000). Backend: Node.js 22, Express 4, Sequelize (port 5000). Database: MySQL via `mysql2`.
- Backend DB config is in `backend/.env`; template `backend/.env.example`. Frontend API base is `REACT_APP_API_URL`; CRA proxy points at `http://localhost:5000`.
- Shared local DB read-only connection to MySQL `localhost:3306` succeeded. Configured test DB `localhost:3307` refused connection. A separate `smart_asset_department_qa_20261006` schema was used for constraint testing. No shared DB rows/schema were modified.
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
| 14 | Full backend regression | Backend | All tests pass | Rerun blocked by sandbox `spawn EPERM`; older baseline had failures | UNVERIFIED | Run in environment allowing Node test subprocesses |
| 15 | Full frontend regression | Frontend | All tests pass | 258/264 pass; 6 failures across four public-page suites | FAIL | Existing rendered copy/link expectations disagree; outside Department Head scope |
| 16 | Production build | Frontend | Build completes | Succeeded with lint/bundle warnings | PASS WITH WARNINGS | Clean warnings/bundle size separately |

## Final totals and remaining work

- Post-fix integrity regression run: **32 passed, 0 failed**.
- Full frontend: **258 passed, 6 failed**. Previous full backend baseline: **486 passed, 14 failed, 9 skipped**; newest run blocked before execution by `spawn EPERM`.
- Shared DB was only read. Isolated schema received the FK migration. Unknown historical assignment references remain unchanged and need source-record/business review before any repair.
- Do not treat the module as production-ready until orphan records are reviewed, shared-database migration is planned, full backend tests run in a supported environment, and approved-credential HTTP/browser E2E and responsive checks pass.
