# Smart Asset Management

A full-stack asset management system with role-based dashboards.

## Project structure

- backend/
- frontend/

## Run backend

```bash
cd backend
npm install
npm run dev
```

## Deploy backend to Render

The repository includes `render.yaml` for the backend web service. Render uses:

```text
Root Directory: backend
Build Command: npm install
Start Command: node server.js
Health Check: /api/health
```

Set the database and `JWT_SECRET` values in Render Environment Variables. For Aiven MySQL, set `DB_SSL=true`; do not commit database credentials.

## Run frontend

```bash
cd frontend
npm install
npm start
```

## Default login

- Username: admin
- Password: bekelei123

## Features

- Role-based login
- Admin, ICT, Department, Finance, Store, Maintenance dashboards
- Asset management APIs
- RFID and maintenance tracking
- Reports and notifications skeleton

## Notes

This project is a complete starter structure for a smart university asset management system.
