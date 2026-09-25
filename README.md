# Smart Asset Management

A full-stack asset management system with role-based dashboards.

## Project structure

- backend/
- frontend/

## Run backend

```bash
npm install --prefix backend
npm start
```

The root `npm start` automatically starts the backend on `http://localhost:5000`.
For backend-only development with file watching, use `npm run dev` from the `backend` directory.

## Deploy backend to Render

The repository includes `render.yaml` for the backend web service. Render uses:

```text
Root Directory: backend
Build Command: npm install
Start Command: node server.js
Health Check: /api/health
```

Set the database and `JWT_SECRET` values in Render Environment Variables. For Aiven MySQL, set `DB_SSL=true`; do not commit database credentials.

For real password reset email delivery, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and `FRONTEND_URL`. In production, `FRONTEND_URL` must be the deployed HTTPS frontend URL. SMTP secrets belong only in backend/Render environment variables and must never be added to frontend environment files.

## Run frontend

```bash
cd frontend
npm install
npm start
```

## Local login

Create local credentials through the configured seed or registration flow. Do not commit passwords.

## Features

- Role-based login
- Admin, ICT, Department, Finance, Store, Maintenance dashboards
- Asset management APIs
- RFID and maintenance tracking
- Reports and notifications skeleton

## Notes

This project is a complete starter structure for a smart university asset management system.
