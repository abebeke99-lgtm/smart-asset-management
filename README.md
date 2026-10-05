# Smart Asset Management

A full-stack asset management system with role-based dashboards.

## Project structure

- backend/
- frontend/

## Run the application

```bash
npm start
```

From the project root, `npm start` automatically starts both services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

Install dependencies first if needed:

```bash
npm install --prefix backend
npm install --prefix frontend
```

For development with backend file watching, use `npm run dev` from the project root.

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

Create local credentials through the configured seed or registration flow. Do not commit passwords.

## Roles and permissions

The administrator Roles & Permissions page uses the existing `configs.role_permissions` record; it does not create separate roles or permission tables. Permission changes require an authenticated administrator, are validated against the backend permission catalog, and are audited in the same database transaction as the matrix update. College and department asset access remains constrained by backend organization-scope checks.

The supported role list includes Teaching Assistant with read-only asset access limited to the account's active department. On the next backend startup, the existing idempotent schema sync adds `teaching_assistant` to `users.role` if it is not already present; back up the database before deploying schema changes.

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
