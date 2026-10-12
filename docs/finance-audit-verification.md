# Finance Audit verification

## Static schema expectations

`AuditLog` maps to `audit_logs` with `underscored: true` inherited from the Sequelize database configuration. The endpoint's `findAll` selects all modeled audit attributes, joins the `User` association (the implicit alias is `User`) through `audit_logs.user_id = users.id`, selects `users.username`, `users.full_name`, and `users.role`, and orders by the model attribute `createdAt`, which maps to `audit_logs.created_at DESC`. There is no `where` clause in `listAudit`; frontend query parameters are currently not used to filter the SQL query.

The model requires these physical `audit_logs` columns:

| Model attribute | MySQL column | Usage |
| --- | --- | --- |
| `id` | `id` | Primary key; selected |
| `userId` | `user_id` | User join foreign key; selected |
| `action` | `action` | Selected |
| `entity` | `entity` | Selected |
| `details` | `details` | Selected |
| `createdAt` | `created_at` | Sequelize timestamp; selected and used for descending order |
| `updatedAt` | `updated_at` | Sequelize timestamp; selected by default |

The included `User` fields resolve to `username`, `full_name`, and `role`; the join target is `users.id`. The application model does not read from or write to `audit_logs_archive` in this endpoint. The smoke script checks modeled audit columns and does not alter the schema. Compare its output with `DESCRIBE audit_logs`; add a column only after confirming it is absent and reviewing the table's data/constraints. No schema alteration is performed by this feature or its smoke test.

## Local smoke test

1. Start the XAMPP MySQL service and confirm the configured database contains `audit_logs` and `users`.
2. From the repository root, start the backend in one terminal:

   ```powershell
   npm --prefix backend start
   ```

3. In a second terminal, run the read-only Finance Audit smoke test:

   ```powershell
   npm --prefix backend run smoke:finance-audit
   ```

   The script reads `backend/.env`, checks the MySQL connection, `audit_logs` model columns, and the `users` join columns, and calls `GET /api/finance/audit` on `http://localhost:5000`. It creates short-lived development JWTs for active database users. It reads no response body and makes no database changes. The backend must be running. Do not run it against production.

   If the active users have different names, set local environment overrides before running:

   ```powershell
   $env:FINANCE_AUDIT_SMOKE_FINANCE_USER = "your-finance-username"
   $env:FINANCE_AUDIT_SMOKE_ADMIN_USER = "your-admin-username"
   $env:FINANCE_AUDIT_SMOKE_NON_FINANCE_USER = "your-non-finance-username"
   npm --prefix backend run smoke:finance-audit
   ```

   Expected results: MySQL connection, `audit_logs` table, and model-column checks pass; Finance and Administrator requests return HTTP 200; the non-finance role request returns HTTP 403; and the no-token request returns HTTP 401. A missing role account or any other status is reported as FAIL.

## Browser checklist

1. Start the frontend with `npm --prefix frontend start` and open `http://localhost:3000`.
2. Sign in as a Finance user and open `/finance/audit` directly, then use the Audit Trail sidebar link. Confirm records, user names, actions, and timestamps appear.
3. Exercise the available search, filters, pagination, and export controls; refresh the page and confirm its loading, empty, and retry-on-error states behave correctly.
4. Sign in as a non-finance user and open `/finance/audit` directly. The frontend should deny access, and the API should return HTTP 403 even when called directly.
5. Sign out and call the endpoint without an Authorization header; it should return HTTP 401.

## Create missing application tables without seeding

If `smart_asset_db` does not exist or application tables are missing, start XAMPP MySQL and run:

```powershell
npm --prefix backend run db:create-schema
```

The command uses the configured database settings, creates the database if necessary, and creates only missing Sequelize model tables. It does not seed accounts or demo records and does not alter existing tables. The MySQL account must have `CREATE DATABASE` and `CREATE` privileges. It refuses to run with `NODE_ENV=production`; this is intended for local development only. If creation is interrupted, rerun the command to retry missing tables, then inspect any reported missing tables before starting the application.

The existing Sequelize helper retries cyclic foreign-key dependencies and may, as its documented fallback, create an otherwise-blocked missing table without foreign-key constraints. The command confirms table existence, not that every association constraint was installed. Review backend startup output and inspect required foreign keys separately if the fallback message appears.

Do not treat the automated smoke test or build as evidence of production verification. Production checks require an explicitly authorized production test account and must follow the production data-handling policy.
