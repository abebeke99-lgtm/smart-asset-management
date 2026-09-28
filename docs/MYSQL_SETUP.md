# Smart Asset Management - MySQL Setup Guide

## Backend MySQL Configuration

Your backend is **fully configured for MySQL** using **Sequelize ORM**.

### Prerequisites

1. **MySQL Server** - Must be running on your system
   - Windows: XAMPP includes MySQL
   - For this project: `localhost:3306`

2. **Node.js** (v14 or higher)

### Step 1: Create MySQL Database

Open MySQL command line or MySQL Workbench:

```sql
CREATE DATABASE smart_asset_db;
USE smart_asset_db;
```

Or if using XAMPP phpMyAdmin:
1. Go to http://localhost/phpmyadmin
2. Click "New" to create a new database
3. Database name: `smart_asset_db`
4. Click "Create"

### Step 2: Update .env File (if needed)

Copy `backend/.env.example` to `backend/.env`, then configure it:

```env
PORT=5000
JWT_SECRET=<generate-a-unique-secret>
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smart_asset_db
DB_USER=root
DB_PASSWORD=
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

Generate `JWT_SECRET` with a cryptographically secure random value. Never use a sample or committed secret. For local development, `JWT_DEV_SECRET` may be set to a separate stable value if tokens and MFA settings must remain valid across restarts.

**For XAMPP:**
- `DB_USER=root`
- `DB_PASSWORD=` (empty)

**For other MySQL installations:**
- Update `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` accordingly

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

This will install:
- **express** - Web framework
- **sequelize** - ORM for MySQL
- **mysql2** - MySQL driver
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **passport** - Authentication middleware
- **cors** - Cross-origin requests
- **nodemon** - Auto-reload in development

### Step 4: Start the Backend Server

```bash
npm run dev
```

Or for production:
```bash
npm start
```

**Expected output:**
```
Database connection established successfully.
Syncing database models...
✓ Database synchronized successfully
Database initialization completed.
Server running on port 5000
```

The backend creates missing tables without dropping or recreating existing tables. Demo accounts are not created by default. To seed them in development, set `SEED_DEMO_DATA=true` and provide `SEED_DEMO_PASSWORD` in the backend environment.

### Step 5: Verify Database Sync

Check your MySQL database:

```sql
USE smart_asset_db;
SHOW TABLES;
```

You should see:
- `users`
- `assets`
- `categories`
- `departments`
- `assignments`
- `maintenances`
- `rfidlogs`
- `notifications`
- `auditlogs`

### Database Models Created

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles (admin, ict_officer, department_head, finance, store_manager, maintenance) |
| `assets` | Asset inventory with details, status, location |
| `categories` | Asset categories (Computers, Furniture, Equipment, etc.) |
| `departments` | Department information |
| `assignments` | Asset assignments to users/departments |
| `maintenances` | Maintenance records and history |
| `rfidlogs` | RFID scanning logs |
| `notifications` | System notifications |
| `auditlogs` | Audit trail for all actions |

### API Endpoints

Base URL: `http://localhost:5000/api`

```
GET  /health              - Health check
POST /auth/register       - User registration
POST /auth/login          - User login
GET  /users               - Get all users
GET  /assets              - Get all assets
POST /assets              - Create new asset
GET  /maintenance         - Get maintenance requests
POST /rfid                - RFID operations
GET  /reports             - Generate reports
```

### Troubleshooting

**Error: "connect ECONNREFUSED 127.0.0.1:3306"**
- MySQL is not running. Start MySQL server first.

**Error: "Access denied for user 'root'@'localhost'"**
- Check MySQL credentials in `.env` file
- Verify MySQL user and password

**Error: "Unknown database 'smart_asset_db'"**
- Create the database first using the SQL command above

**Error: "Tables already exist"**
- Set `DB_SYNC_FORCE=false` in `.env` to preserve data
- Or set `DB_SYNC_FORCE=true` to recreate tables (will lose data)

### Next Steps

1. ✅ Create MySQL database
2. ✅ Update `.env` with your MySQL credentials
3. ✅ Install dependencies: `npm install`
4. ✅ Start server: `npm run dev`
5. 📱 Set up the React frontend
6. 🔐 Change default admin password
7. 🚀 Deploy to production

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `JWT_SECRET` | JWT signing secret (required in production) | generated development secret |
| `JWT_DEV_SECRET` | Optional stable local development secret | unset |
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_NAME` | Database name | smart_asset_db |
| `DB_USER` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | (empty) |
| `CLIENT_URL` | Frontend URL for CORS | http://localhost:3000 |
| `NODE_ENV` | Environment | development |
