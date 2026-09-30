# UAMS Production Deployment

These existing instructions cover Render/Aiven. For Railway + Railway MySQL, use the additional setup below; the application still uses the same Express, Sequelize, and MySQL architecture.

## Architecture

- Frontend: Create React App (React 18) deployed to Vercel from the repository root. The Vercel build command produces `frontend/build`.
- Backend: Node.js 22 / Express 4 deployed to Render from `backend/`.
- Database: Sequelize 6 with `mysql2` connecting to MySQL on Aiven. PostgreSQL, Neon, and Supabase are not used.
- Frontend API configuration: set `REACT_APP_API_URL` to the Render API origin ending in `/api`. It is embedded into the public browser bundle, so it must contain no credentials.

## Database and Schema Safety

There is no versioned migration runner. Backend startup loads all Sequelize models and associations, then runs the existing custom schema synchronizer in every environment before opening the HTTP listener. It creates missing model tables, adds selected missing columns and constraints, changes the `maintenance_inspections.maintenance_id` column, creates missing password-recovery indexes, and removes duplicate non-primary indexes. It does not drop tables or truncate rows and does not run `sync({ force: true })` or `alter: true`; it does execute DDL against existing tables. Startup fails if any registered model table remains missing. Test the synchronizer against a restored staging copy and keep a verified backup before deploying schema changes. `DB_SYNC_ON_START` is no longer used.

The `PasswordRecovery` model maps to `password_recoveries`. Its logical fields are `id`, `userId`, `method`, `destination`, `otpHash`, `expiresAt`, `attempts`, `verifiedAt`, `usedAt`, and Sequelize timestamps `createdAt`/`updatedAt`. With underscored naming, most fields are stored as `user_id`, `otp_hash`, `expires_at`, `verified_at`, `used_at`, `created_at`, and `updated_at`. Model indexes cover user, destination, expiry, and reset-token hash.

1. Take and retain a verified source backup before import. Use a MySQL client compatible with the source server and Aiven's target server. For InnoDB tables, a safe dump pattern is:

   ```powershell
   mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 SOURCE_DATABASE > uams-backup.sql
   ```

   Supply credentials interactively or through a private client option file outside the repository. Do not put credentials in shell history, this file, or source control. Quiesce writes during export if any source tables are not transactional.

2. Create a new Aiven MySQL service using the same major MySQL version as the source where possible. Confirm the selected plan's connection limit and that Render can reach the service. Restrict Aiven access to the Render service's egress addresses or another approved network path.

3. Download the Aiven CA certificate from the service console. Import the dump into the intended Aiven database over TLS, after confirming the target is the new/empty target and the selected schema is correct:

   ```powershell
   mysql --host=AVIEN_HOST --port=AVIEN_PORT --user=AVIEN_USER --ssl-mode=VERIFY_IDENTITY --ssl-ca=PATH_TO_AIVEN_CA TARGET_DATABASE < uams-backup.sql
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
| `DB_HOST` | Required when using `DB_*` | Aiven host. |
| `DB_PORT` | Required when using `DB_*` | Aiven service port, commonly not 3306. |
| `DB_NAME` | Required when using `DB_*` | Existing application database/schema. |
| `DB_USER` | Required when using `DB_*` | Aiven database user. |
| `DB_PASSWORD` | Required when using `DB_*` | Aiven database password. |
| `DATABASE_URL` | Alternative to `DB_*` | MySQL URL supported by Sequelize/mysql2; URL-encode reserved credential characters. Prefer one connection form, not both. |
| `DB_SSL` | `true` | Required for Aiven. Do not disable TLS. |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Keep certificate validation enabled. |
| `DB_SSL_CA` | Aiven CA certificate | Paste the CA certificate when needed to validate Aiven's server certificate. |
| `DB_POOL_MAX` | Optional | Default is 10; keep total Render instances/pool capacity within the Aiven plan limit. |
| `DB_CHARSET` | Optional | Defaults to `utf8mb4`. |
| `DB_COLLATION` | Optional | New tables default to `utf8mb4_unicode_ci`; existing tables are not globally converted. |
| `DB_TIMEZONE` | Optional | Defaults to `+00:00` (UTC). |
| `FRONTEND_URL` | Required | Exact HTTPS Vercel production origin, e.g. `https://uams-college.vercel.app`, without `/api`. Used by CORS and reset links. |
| `CORS_ORIGINS` | Optional | Comma-separated additional exact origins, such as approved Vercel preview domains. No wildcard. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Required for email OTP | For Gmail use `smtp.gmail.com`, port `465` (implicit TLS), and a Google App Password created with 2-Step Verification enabled. Do not use the normal account password. Equivalent `SMTP_*` names are supported. |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_ID` | Required for SMS OTP | Use `twilio` or `africastalking` and the corresponding provider credentials. `SMS_SENDER` remains a compatibility alias. |
| `PASSWORD_RESET_OTP_TTL_MINUTES` | `5` | OTP expiry. |
| `PASSWORD_RESET_OTP_MAX_ATTEMPTS` | `5` | The implementation caps this setting at five. |
| `UPLOAD_DIR` | Optional | Defaults to backend-local `uploads/`. Render local disk is ephemeral. Use a persistent Render disk mounted at a path such as `/var/data/uploads`, or move uploads to external object storage (for example, an S3-compatible bucket) before relying on production persistence. |

Password-recovery and general API rate limiters currently keep state in process memory. They do not coordinate across multiple Render instances and reset on process restart. Run a single backend instance until a shared rate-limit store is implemented and configured.

`DB_SSL_CA` should contain the certificate text, not a private key. The application uses SSL automatically for Aiven hostnames and keeps `rejectUnauthorized` enabled by default. MySQL pool capacity, foreign keys, transactions, and indexes use Sequelize/mysql2; verify target behavior against the selected Aiven MySQL version and plan before cutover.

### Vercel frontend

Set the following for the Production environment and redeploy after changing it:

```text
REACT_APP_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Set the same variable for Preview only if preview deployments should call a backend that explicitly allows those preview origins. Do not use a `VITE_*` variable; this project uses Create React App. No Render URL is hard-coded in application source or deployment descriptors.

## Deployment Order

1. Push the existing project to GitHub. Confirm `.env`, `.env.production`, and `.env.local` are not staged; `.env.example` is safe to commit.
2. Create an Aiven MySQL service. Select a version compatible with the existing MySQL source and application data.
3. Configure the Aiven database user, schema, TLS certificate, and network access. Keep certificate verification enabled.
4. Back up and import the existing database using the safe procedure above. Preserve the source database and compare row counts.
5. Verify the Aiven host, port, schema, user, TLS handshake, tables, indexes, and foreign keys using a staging connection first.
6. Create a Render Node/Express Web Service from `render.yaml`; it contains only the backend service.
7. Configure the Render variables above. Set `FRONTEND_URL` to the intended HTTPS Vercel origin. Add SMTP/SMS provider credentials only in the Render dashboard.
8. Deploy the backend. Review startup logs for successful MySQL authentication and schema synchronization; logs should not contain credentials or OTPs.
9. Test `https://YOUR-RENDER-SERVICE.onrender.com/health`. It must return HTTP 200 and `{"status":"ok"}` when the database is ready.
10. Copy the assigned Render backend URL.
11. Configure Vercel `REACT_APP_API_URL` as the Render URL plus `/api`.
12. Deploy the React frontend to Vercel using the root `vercel.json` build/output settings.
13. Set Render `FRONTEND_URL` to the final Vercel origin and redeploy the backend. Configure any approved extra origins with `CORS_ORIGINS`.
14. Verify browser requests from Vercel reach Render, and Render reads the Aiven database. Check CORS and network access without exposing credentials.
15. Test login with an existing authorized account.
16. Test logout and confirm the prior bearer token is rejected afterward.
17. Test email OTP using a real SMTP account and mailbox.
18. Test SMS OTP using a real Twilio or Africa's Talking account and a supported Ethiopian phone number.
19. Verify five-minute expiry, the five-attempt limit, 60-second resend cooldown, and password reset with the real backend/database.
20. Log in with the new password and compare existing data counts with the pre-deployment backup.

Do not declare production deployment successful until the React app, Render backend, Aiven connectivity, health endpoint, browser API calls, login/logout, both OTP channels, OTP limits/expiry, reset, new-password login, and data preservation have all been verified against the deployed services.

## Railway Backend and MySQL

The repository's `railway.json` builds backend dependencies and starts the root production script, which delegates to `backend/src/app.js`. The API reads Railway's `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, and `MYSQLPASSWORD` directly, or the equivalent `DB_*` variables. Explicit `DB_*` values take precedence; `DATABASE_URL` or `MYSQL_URL` can be used instead.

In the Railway project, keep the backend and MySQL services in the same project/environment. In the backend service's Variables panel, add references to the actual MySQL service name (replace `MySQL` below if the service has another name):

```text
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
NODE_ENV=production
JWT_SECRET=<generate and store a high-entropy secret in Railway>
FRONTEND_URL=https://<your-frontend-domain>
```

Railway variable references are service-name-sensitive. Confirm each referenced value in Railway's Variables view without copying secrets into source control. Use the MySQL service's private host/port for an internal Railway connection. Leave `DB_SSL` unset/false unless Railway's current provider settings explicitly require TLS; if required, configure certificate verification rather than disabling it. The app also accepts Railway's `MYSQL*` variables directly if those are exposed to the backend service.

### Railway UI Checklist

1. Open the Railway project and confirm a MySQL service exists. If it does not, use **New > Database > MySQL**; do not create credentials in source code.
2. Open the backend application service, select **Variables**, and choose **Add Reference** (or the equivalent service-variable reference action).
3. Select the actual MySQL service name and map its generated variables to the backend names. Replace `<actual-mysql-service>` below with the service selected in Railway; never guess the name:

   ```text
   DB_HOST=${{<actual-mysql-service>.MYSQLHOST}}
   DB_PORT=${{<actual-mysql-service>.MYSQLPORT}}
   DB_NAME=${{<actual-mysql-service>.MYSQLDATABASE}}
   DB_USER=${{<actual-mysql-service>.MYSQLUSER}}
   DB_PASSWORD=${{<actual-mysql-service>.MYSQLPASSWORD}}
   ```

4. Add `JWT_SECRET` as a Railway secret and set `NODE_ENV=production`. Set `FRONTEND_URL` or `CORS_ORIGINS` to the exact frontend origin.
5. Save the variables and redeploy the backend service. In the deployment logs, confirm Sequelize authentication and schema initialization succeed before the server starts listening.
6. Verify `GET /health` and `GET /api/health` return `200` with a connected database, an unauthenticated protected endpoint returns `401`, and an authenticated endpoint works using an existing legitimate account.

The existing local development database name defaults to `smart_asset_db`; production must use the Railway service's actual `MYSQLDATABASE` (or its `DB_NAME` reference), not an assumed name. There is no versioned migration runner. Production startup creates missing model tables and applies the synchronizer's selected schema repairs; this includes DDL and duplicate-index repair on existing tables. Back up the target and test against a restored staging copy before deployment. Do not use schema sync as a substitute for importing existing XAMPP records.

To preserve the existing XAMPP data, first verify the actual source schema name, take a verified MySQL dump, and import that dump into the selected Railway database without dropping/truncating tables. Keep the source unchanged and compare table/row counts before cutover. Do not commit dumps or put credentials in shell history or repository files. The repository does not contain production Railway credentials, so connectivity and data import must be verified after the service references are configured.

For the frontend service, set the build-time variable `REACT_APP_API_URL` to `https://<your-railway-backend-domain>/api`, then rebuild/redeploy the React app. Set backend `FRONTEND_URL` to the frontend's exact origin; additional approved origins may use `CLIENT_URL`, `CORS_ORIGIN`, or comma-separated `CORS_ORIGINS`. The existing monitoring screen calls `/admin/monitoring/overview`, which resolves through the shared API client to the backend's `/api/admin/monitoring/overview` route and remains admin-authenticated.

`GET /health` and `GET /api/health` run `SELECT 1` and return HTTP 200 only when MySQL is reachable; they return HTTP 503 when it is unavailable. Database initialization, including model-table creation, completes before the listener starts. Verify backend logs for successful Sequelize authentication and schema initialization after configuring Railway variables.
