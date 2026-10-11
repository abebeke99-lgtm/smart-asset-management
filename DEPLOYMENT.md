# UAMS Production Deployment

These instructions configure the existing application for a React frontend and Express backend on Render, with MySQL hosted on Railway.

## Architecture

- Frontend: Create React App (React 18) deployed as a Render static site from `frontend/`.
- Backend: Node.js 22 / Express 4 deployed to Render from `backend/`.
- Database: Sequelize 6 with `mysql2` connecting to MySQL on Railway. PostgreSQL, Neon, and Supabase are not used.
- Frontend API configuration: the Render Blueprint builds `REACT_APP_API_URL` from the backend service hostname. It is embedded into the public browser bundle, so it must contain no credentials.

## Database and Schema Safety

There is no versioned migration runner. Backend startup loads all Sequelize models and associations, then runs the existing custom schema synchronizer in every environment before opening the HTTP listener. It creates missing model tables, adds selected missing columns and constraints, changes the `maintenance_inspections.maintenance_id` column, creates missing password-recovery indexes, and removes duplicate non-primary indexes. It also runs the idempotent `adminRfidTracking` QR-column repair: when `assets.qr_code` is absent it adds that column as nullable, fills it from `digital_id` (or generates QR values for rows without one), then enforces the model's non-null and unique requirements. It does not drop tables or truncate rows and does not run `sync({ force: true })` or `alter: true`; it does execute DDL and targeted backfills against existing tables. Startup fails if any registered model table remains missing or QR values cannot be made unique. Test the synchronizer against a restored staging copy and keep a verified backup before deploying schema changes. Setting `DB_SYNC_ON_START=false` skips the general synchronizer, but does not skip the QR-column repair. When startup sync is disabled, apply the repeatable store schema migrations in `backend/database/migrations/` (including `20261010_store_workflow_columns.sql` and `20261010_store_stock_operation_idempotency.sql`) before using the corresponding store endpoints.

The `PasswordRecovery` model maps to `password_recoveries`. Its logical fields are `id`, `userId`, `method`, `destination`, `otpHash`, `expiresAt`, `attempts`, `verifiedAt`, `usedAt`, and Sequelize timestamps `createdAt`/`updatedAt`. With underscored naming, most fields are stored as `user_id`, `otp_hash`, `expires_at`, `verified_at`, `used_at`, `created_at`, and `updated_at`. Model indexes cover user, destination, expiry, and reset-token hash.

1. Take and retain a verified source backup before import. Use a MySQL client compatible with the source and Railway target servers. For InnoDB tables, a safe dump pattern is:

   ```powershell
   mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 SOURCE_DATABASE > uams-backup.sql
   ```

   Supply credentials interactively or through a private client option file outside the repository. Do not put credentials in shell history, this file, or source control. Quiesce writes during export if any source tables are not transactional.

2. Create or select the intended Railway MySQL service using the same major MySQL version as the source where possible. Confirm the selected plan's connection limit and that Render can reach it. Render is outside Railway's private network; use Railway's public TCP proxy unless a verified private network path is available.

3. If the Railway connection requires TLS, obtain its CA certificate from the service console and verify the certificate. Import the dump into the intended Railway database, after confirming the target and schema are correct:

   ```powershell
   mysql --host=RAILWAY_PUBLIC_HOST --port=RAILWAY_PUBLIC_PORT --user=RAILWAY_USER --ssl-mode=VERIFY_IDENTITY --ssl-ca=PATH_TO_RAILWAY_CA TARGET_DATABASE < uams-backup.sql
   ```

   Enter the password when prompted. Never run `DROP DATABASE`, `DROP TABLE`, or `TRUNCATE` as part of this procedure. Keep the source intact until row counts and application behavior have been compared.

4. Compare table counts and representative row counts between source and target. Confirm `password_recoveries` columns and indexes with:

   ```sql
   SELECT COLUMN_NAME
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_recoveries'
   ORDER BY ORDINAL_POSITION;

   SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
   FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_recoveries'
   ORDER BY INDEX_NAME, SEQ_IN_INDEX;
   ```

   Also inspect `information_schema.KEY_COLUMN_USAGE` for expected foreign keys and verify the application's critical indexes. The startup synchronizer can fall back to creating cyclic-reference tables without foreign-key constraints; do not assume a missing constraint was created. Compare source and target schema before cutover.

## Environment Variables

### Render backend

Set these in the Render service environment. Do not commit populated environment files.

| Variable | Requirement | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Set by `render.yaml`. |
| `NODE_VERSION` | `22.16.0` | The manifests also declare Node `22.x`. |
| `JWT_SECRET` | Required | Generate a high-entropy secret and store only in Render. |
| `DB_HOST` | Required when using `DB_*` | Railway's reachable public TCP-proxy host when Render has no verified private path. |
| `DB_PORT` | Required when using `DB_*` | Railway's reachable TCP-proxy port, commonly not 3306. |
| `DB_NAME` | Required when using `DB_*` | Existing application database/schema. |
| `DB_USER` | Required when using `DB_*` | Railway database user. |
| `DB_PASSWORD` | Required when using `DB_*` | Railway database password. |
| `DATABASE_URL` | Alternative to `DB_*` | MySQL URL supported by Sequelize/mysql2; URL-encode reserved credential characters. Prefer one connection form, not both. |
| `DB_SSL` | Provider-dependent | Set `true` only when required by the selected Railway endpoint; keep certificate validation enabled. |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Keep certificate validation enabled. |
| `DB_SSL_CA` | Railway CA certificate | Configure the CA certificate when needed to validate the Railway server certificate. |
| `DB_POOL_MAX` | Optional | Default is 10; keep total Render instances/pool capacity within the Railway plan limit. |
| `DB_CHARSET` | Optional | Defaults to `utf8mb4`. |
| `DB_COLLATION` | Optional | New tables default to `utf8mb4_unicode_ci`; existing tables are not globally converted. |
| `DB_TIMEZONE` | Optional | Defaults to `+00:00` (UTC). |
| `STORE_DEFAULT_REORDER_LEVEL` | Optional | Defaults to 5. Used when an inventory row has no positive item-specific reorder level; set a non-negative whole number. |
| `FRONTEND_URL` | Required | Exact HTTPS Render frontend origin, without `/api`. The Blueprint references the Render frontend host. Used by CORS and reset links. |
| `CORS_ORIGINS` | Optional | Comma-separated additional exact origins, such as approved Render preview domains. No wildcard. |
| `MAIL_DRIVER` | `smtp` in deployed environments | Must be explicitly set to `smtp` to deliver email. `log` is development-only and prints recovery codes to the backend console instead of emailing them. |

### Store low-stock calculation

Low-stock alerts use the inventory row's `availableQuantity` as the authoritative available balance; reservation and transaction records are not subtracted again. A positive `minimumQuantity` is the item's reorder level. A stored zero (the legacy/default state) uses `STORE_DEFAULT_REORDER_LEVEL`. Available quantity at or below zero is classified out of stock, and negative balances are separately flagged as data-integrity errors. Positive balances at or below the effective reorder level are low stock; other rows are excluded. Serialized assets, expired items, and items marked unusable or unavailable are not treated as quantity-based replenishment alerts. Changing an item's reorder level to zero returns it to the system default.
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Required for email OTP | For Gmail use `smtp.gmail.com`, port `465` with `EMAIL_SECURE=true` (implicit TLS), and a Google App Password created with 2-Step Verification enabled. Do not use the normal account password. Port `587` uses `EMAIL_SECURE=false` (STARTTLS). Equivalent `SMTP_*` names are supported. |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_ID` | Required for SMS OTP | Use `twilio` or `africastalking` and the corresponding provider credentials. `SMS_SENDER` remains a compatibility alias. |
| `PASSWORD_RESET_OTP_TTL_MINUTES` | `5` | OTP expiry. |
| `PASSWORD_RESET_OTP_MAX_ATTEMPTS` | `5` | The implementation caps this setting at five. |
| `UPLOAD_DIR` | Optional | Defaults to backend-local `uploads/`. Render local disk is ephemeral. Use a persistent Render disk mounted at a path such as `/var/data/uploads`, or move uploads to external object storage (for example, an S3-compatible bucket) before relying on production persistence. |

Password-recovery and general API rate limiters currently keep state in process memory. They do not coordinate across multiple Render instances and reset on process restart. Run a single backend instance until a shared rate-limit store is implemented and configured.

For local `.env` setup, the development default is `MAIL_DRIVER=log` with blank SMTP credentials. To test real delivery, switch to `MAIL_DRIVER=smtp` and set the SMTP host, port, secure mode, username, password/app password, and sender address. The backend runs an SMTP `verify()` check at startup and logs connection/authentication diagnostics; check these server logs without exposing credentials. You can also check connectivity from `backend/` with `node scripts/check-smtp.js`.

`DB_SSL_CA` should contain the certificate text, not a private key. The application keeps `rejectUnauthorized` enabled by default. MySQL pool capacity, foreign keys, transactions, and indexes use Sequelize/mysql2; verify target behavior against the selected Railway MySQL version and plan before cutover.

### Render frontend

`render.yaml` derives the frontend's build-time API URL from the Render backend service hostname:

```text
REACT_APP_API_URL=https://<Render backend host>/api
```

Do not use a `VITE_*` variable; this project uses Create React App. The Render Blueprint also references the frontend hostname for backend CORS and password-reset links.

## Deployment Order

1. Push the existing project to GitHub. Confirm `.env`, `.env.production`, and `.env.local` are not staged; `.env.example` is safe to commit.
2. Create or select a Railway MySQL service. Select a version compatible with the existing MySQL source and application data.
3. Configure the Railway database user, schema, reachable TCP endpoint, TLS settings, and network access. Keep certificate verification enabled when TLS is used.
4. Back up and import the existing database using the safe procedure above. Preserve the source database and compare row counts.
5. Verify the Railway host, port, schema, user, TLS handshake when configured, tables, indexes, and foreign keys using a staging connection first.
6. Create the Render backend Web Service and frontend Static Site from `render.yaml`.
7. Configure the Render backend variables above, including Railway MySQL credentials and `MAIL_DRIVER=smtp`. Add SMTP/SMS provider credentials only in the Render dashboard.
8. Deploy the backend. Review startup logs for successful MySQL authentication, schema synchronization, and SMTP verification; logs should not contain credentials or OTPs.
9. Test `https://YOUR-RENDER-SERVICE.onrender.com/health`. It must return HTTP 200 and `{"status":"ok"}` when the database is ready.
10. Copy the assigned Render backend URL.
11. Confirm the Render Blueprint service references resolve to the intended backend and frontend hosts.
12. Deploy the React frontend to Render; the Blueprint supplies the API URL during its build.
13. Confirm backend `FRONTEND_URL` resolves to the Render frontend origin and redeploy if needed. Configure any approved extra origins with `CORS_ORIGINS`.
14. Verify browser requests from the Render frontend reach the Render backend, and the backend reads the Railway database. Check CORS and network access without exposing credentials.
15. Test login with an existing authorized account.
16. Test logout and confirm the prior bearer token is rejected afterward.
17. Test email OTP using a real SMTP account and mailbox.
18. Test SMS OTP using a real Twilio or Africa's Talking account and a supported Ethiopian phone number.
19. Verify five-minute expiry, the five-attempt limit, 60-second resend cooldown, and password reset with the real backend/database.
20. Log in with the new password and compare existing data counts with the pre-deployment backup.

Do not declare production deployment successful until the React app, Render backend, Railway connectivity, health endpoint, browser API calls, login/logout, both OTP channels, OTP limits/expiry, reset, new-password login, and data preservation have all been verified against the deployed services.

## Railway MySQL with Render Backend

The production backend and frontend are Render services described by `render.yaml`. Railway hosts MySQL only. The backend accepts `DATABASE_URL`/`MYSQL_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; Railway `MYSQL*` aliases are also supported when available. Explicit `DB_*` values take precedence when no connection URL is configured. The Blueprint uses individual `DB_*` values and explicitly disables demo seeding.

Render and Railway do not share service-variable references. Configure the Railway connection values in the Render backend's Environment settings and keep passwords, `DATABASE_URL`, and `JWT_SECRET` in secret fields. Render is outside Railway's private network, so use Railway's public TCP proxy unless an alternate network route has been explicitly verified. Configure `DB_SSL` and `DB_SSL_CA` according to the selected endpoint, keeping certificate validation enabled whenever TLS is used.

### Railway and Render UI Checklist

1. In Railway, confirm the intended MySQL service and database. Obtain the endpoint intended for an external client (normally the public TCP proxy); do not assume `*.railway.internal` is reachable from Render.
2. In the Render backend service's Environment settings, configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and secret `DB_PASSWORD`. Set `NODE_ENV=production`, a high-entropy `JWT_SECRET`, and provider-appropriate TLS settings.
3. The Render Blueprint derives `REACT_APP_API_URL` from the Render backend hostname during frontend build and references the Render frontend hostname for backend `FRONTEND_URL`. If service names change, update the references in `render.yaml`. The Blueprint requests the individual `DB_*` values rather than `DATABASE_URL`, avoiding the URL-first precedence in database configuration; configure exactly one connection style.
4. Redeploy the backend and frontend from the Blueprint. Confirm Sequelize authentication and schema initialization succeed before the backend begins listening.
5. Verify `GET /health` and `GET /api/health` return `200` with a connected database, an unauthenticated protected endpoint returns `401`, and an authenticated endpoint works using an existing legitimate account.

The local development database name defaults to `smart_asset_db`; production must use the actual Railway `MYSQLDATABASE`, not an assumed name. There is no versioned migration runner. Production startup creates missing model tables and applies selected schema repairs, including DDL and targeted backfills, even when `DB_SYNC_ON_START=false` skips the general synchronizer. Back up the target and test against a restored staging copy before deployment. Do not use schema sync as a substitute for importing existing XAMPP records.

To preserve existing XAMPP data, first verify the source schema, take a verified MySQL dump, and import it into the selected Railway database without dropping or truncating tables. Keep the source unchanged and compare table/row counts before cutover. Do not commit dumps or put credentials in shell history or repository files. Actual connection and data verification require authorized Railway access.

**Secret rotation:** a populated `JWT_SECRET` was present in the repository's initial Git history before `.env` was ignored. Treat it as exposed. Replace any production JWT secret that may match it with a new unique high-entropy value in Render, then redeploy; this invalidates existing JWTs. Do not print or reuse the historical value.

The existing monitoring screen calls `/admin/monitoring/overview`, which resolves through the shared API client to `/api/admin/monitoring/overview` and remains admin-authenticated. `GET /health` and `GET /api/health` run `SELECT 1` and return HTTP 200 only when MySQL is reachable; they return HTTP 503 when it is unavailable. Database initialization completes before the listener starts. Verify backend logs for successful Sequelize authentication and schema initialization after configuring Render variables.
