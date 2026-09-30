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

## Features

- Role-based login
- Admin, ICT, Department, Finance, Store, Maintenance dashboards
- Asset management APIs
- RFID and maintenance tracking
- Reports and notifications skeleton

## Notes

This project is a complete starter structure for a smart university asset management system.
