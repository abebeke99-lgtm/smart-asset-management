// Simple Express backend for /api/users with MySQL persistence
// Load environment variables from .env when present
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const app = express();
const PORT = process.env.PORT || 3001;
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'asset_management_db';

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin', 'X-User-Role', 'X-User-Id'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/', (req, res, next) => {
  req.headers.cookie = '';
  next();
});

app.use((req, res, next) => {
  try {
    const addr = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    console.log(`Incoming request: ${req.method} ${req.originalUrl || req.url} from ${addr}`);
  } catch (e) {}
  next();
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
  next(err);
});

function useAdmin(req, res, next) {
  if ((process.env.NODE_ENV || 'development') !== 'production') return next();
  const adminHeader = req.headers['x-admin'];
  const auth = req.headers.authorization || '';
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
  if (String(adminHeader) === 'true') return next();
  if (auth === `Bearer ${ADMIN_TOKEN}`) return next();
  return res.status(403).json({ success: false, message: 'Admin privileges required' });
}

let dbPool = null;
let users = [
  { id: 0, username: 'admin', password: 'admin123', role: 'admin', phone: '' },
  { id: 1, username: 'alice', password: 'password123', role: 'student', phone: '+15550000001' },
  { id: 2, username: 'bob', password: 'password123', role: 'student', phone: '+15550000002' },
  { id: 3, username: 'charlie', password: 'password123', role: 'student', phone: '+15550000003' },
  { id: 4, username: 'mau123456', password: 'password123', role: 'student', phone: '+15550000004' },
  { id: 5, username: 'mau160011', password: 'password123', role: 'student', phone: '+15550000005' },
  { id: 6, username: 'mau160022', password: 'password123', role: 'student', phone: '+15550000006' }
];
let menuItems = [
  { id: 1, mealType: 'Breakfast', item: 'Tea', time: '7:00 AM - 9:00 AM' },
  { id: 2, mealType: 'Lunch', item: 'Sandwich', time: '12:00 PM - 2:00 PM' }
];
let feedbacks = [];
let replies = [];
let notifications = [];
let inventory = [
  { id: 1, item: 'Bread', quantity: 50 },
  { id: 2, item: 'Eggs', quantity: 100 }
];
let assets = [];
let lostIdReports = [];

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

async function query(sql, params = []) {
  if (!dbPool) throw new Error('Database not available');
  const [rows] = await dbPool.query(sql, params);
  return rows;
}

async function createDatabaseIfNeeded() {
  const connection = await mysql.createConnection({ host: MYSQL_HOST, port: MYSQL_PORT, user: MYSQL_USER, password: MYSQL_PASSWORD });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await connection.end();
}

async function createTables() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) DEFAULT '',
    role VARCHAR(50) DEFAULT 'student',
    fullName VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(100) DEFAULT '',
    fingerprintId VARCHAR(255) DEFAULT '',
    responsibility VARCHAR(100) DEFAULT 'member',
    universityID VARCHAR(100) DEFAULT '',
    department VARCHAR(100) DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS menu (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mealType VARCHAR(255) DEFAULT '',
    item VARCHAR(255) DEFAULT '',
    time VARCHAR(255) DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rating INT,
    comment TEXT,
    userId VARCHAR(100) DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS replies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parentType VARCHAR(255) DEFAULT '',
    parentId VARCHAR(100) DEFAULT '',
    text TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) DEFAULT '',
    item VARCHAR(255) DEFAULT '',
    quantity INT DEFAULT 0,
    measurement VARCHAR(100) DEFAULT 'piece',
    quality VARCHAR(100) DEFAULT 'Good',
    status VARCHAR(100) DEFAULT 'Available',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message TEXT,
    \`to\` VARCHAR(100) DEFAULT 'all',
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`read\` BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    \`key\` VARCHAR(255) NOT NULL UNIQUE,
    \`value\` TEXT DEFAULT '{}',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS lost_ids (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studentId VARCHAR(255) DEFAULT '',
    name VARCHAR(255) DEFAULT '',
    phone VARCHAR(100) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    mauAccount VARCHAR(255) DEFAULT '',
    paymentRef VARCHAR(255) DEFAULT '',
    reason TEXT,
    status VARCHAR(100) DEFAULT 'reported',
    adminNote TEXT,
    reportedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) DEFAULT '',
    category VARCHAR(255) DEFAULT '',
    description TEXT,
    serial_number VARCHAR(255) DEFAULT '',
    asset_code VARCHAR(255) DEFAULT '',
    rfid_tag VARCHAR(255) DEFAULT '',
    status VARCHAR(100) DEFAULT 'available',
    \`condition\` VARCHAR(100) DEFAULT 'Good',
    department VARCHAR(255) DEFAULT '',
    location VARCHAR(255) DEFAULT '',
    purchase_date DATETIME NULL,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    supplier VARCHAR(255) DEFAULT '',
    manufacturer VARCHAR(255) DEFAULT '',
    model VARCHAR(255) DEFAULT '',
    warranty_expiry DATETIME NULL,
    notes TEXT,
    current_value DECIMAL(12,2) DEFAULT 0,
    health_score INT DEFAULT 100,
    created_by INT DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    image LONGTEXT NULL,
    UNIQUE KEY unique_serial_number (serial_number),
    UNIQUE KEY unique_asset_code (asset_code),
    UNIQUE KEY unique_rfid_tag (rfid_tag)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  await query(`CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

async function seedInitialData() {
  const rows = await query('SELECT COUNT(*) as count FROM users');
  const userCount = rows[0].count;
  const demoUsers = [
    ['admin', 'bekelei123', 'admin', '', 'bekelei906@gmail.com', '', '', '', '', '', true],
    ['ict_officer', 'bekelei123', 'ict_officer', '', 'bekelei906@gmail.com', '', '', '', '', '', true],
    ['dept_head', 'bekelei123', 'department_head', '', 'bekelei906@gmail.com', '', '', '', '', '', true],
    ['store_manager', 'bekelei123', 'store_manager', '', 'bekelei906@gmail.com', '', '', '', '', '', true],
    ['finance', 'bekelei123', 'finance', '', 'bekelei906@gmail.com', '', '', '', '', '', true],
    ['maintenance', 'bekelei123', 'maintenance', '', 'bekelei906@gmail.com', '', '', '', '', '', true]
  ];
  if (userCount === 0) {
    await query('INSERT INTO users (username, password, role, fullName, email, phone, fingerprintId, responsibility, universityID, department, active) VALUES ?', [
      demoUsers
    ]);
    console.log('Seeded initial users into MySQL');
  } else {
    await query(`INSERT INTO users (username, password, role, fullName, email, phone, fingerprintId, responsibility, universityID, department, active) VALUES ? ON DUPLICATE KEY UPDATE password=VALUES(password), role=VALUES(role), fullName=VALUES(fullName), email=VALUES(email), active=VALUES(active)`, [
      demoUsers
    ]);
    console.log('Updated demo users in MySQL');
  }
  const menuRows = await query('SELECT COUNT(*) as count FROM menu');
  const menuCount = menuRows[0].count;
  if (menuCount === 0) {
    await query('INSERT INTO menu (mealType, item, time) VALUES ?', [[
      ['Breakfast', 'Tea', '7:00 AM - 9:00 AM'],
      ['Lunch', 'Sandwich', '12:00 PM - 2:00 PM']
    ]]);
    console.log('Seeded initial menu items into MySQL');
  }
  const inventoryRows = await query('SELECT COUNT(*) as count FROM inventory');
  const inventoryCount = inventoryRows[0].count;
  if (inventoryCount === 0) {
    await query('INSERT INTO inventory (item, quantity) VALUES ?', [[
      ['Bread', 50],
      ['Eggs', 100]
    ]]);
    console.log('Seeded initial inventory items into MySQL');
  }
  const configRows = await query('SELECT COUNT(*) as count FROM config');
  const configCount = configRows[0].count;
  if (configCount === 0) {
    await query('INSERT INTO config (`key`, `value`) VALUES (?, ?)', ['default', JSON.stringify({ welcomeMessage: 'Welcome to MAU Smart University Asset Management System', theme: 'blue' })]);
    console.log('Seeded initial config into MySQL');
  }

  const departmentRows = await query('SELECT COUNT(*) as count FROM departments');
  if (departmentRows[0].count === 0) {
    await query('INSERT INTO departments (name, description) VALUES ?', [[
      ['ICT', 'Information and Communication Technology'],
      ['Finance', 'Finance and accounting'],
      ['Procurement', 'Procurement and supplies'],
      ['Administration', 'Administration and support services']
    ]]);
    console.log('Seeded default departments into MySQL');
  }

  const categoryRows = await query('SELECT COUNT(*) as count FROM categories');
  if (categoryRows[0].count === 0) {
    await query('INSERT INTO categories (name, description) VALUES ?', [[
      ['Computer Equipment', 'Computers and related equipment'],
      ['Office Furniture', 'Desks, chairs, and office furniture'],
      ['Network Equipment', 'Routers, switches, and network devices'],
      [' laboratory Equipment', 'Laboratory and technical equipment']
    ]]);
    console.log('Seeded default categories into MySQL');
  }
}

function normalizeUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role || (row.username === 'admin' ? 'admin' : /^cafstaff/i.test(row.username) ? 'staff' : 'student'),
    fullName: row.fullName || '',
    email: row.email || '',
    phone: row.phone || '',
    fingerprintId: row.fingerprintId || '',
    responsibility: row.responsibility || 'member',
    universityID: row.universityID || '',
    department: row.department || '',
    active: row.active === 1 || row.active === true
  };
}

async function tryConnectMySQL() {
  try {
    await createDatabaseIfNeeded();
    dbPool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z'
    });
    await query('SELECT 1');
    await createTables();
    await seedInitialData();
    console.log('Connected to MySQL:', MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE);
    return true;
  } catch (err) {
    console.error('MySQL connection failed:', err && err.message ? err.message : err);
    dbPool = null;
    return false;
  }
}

async function sendSmsToFeedbackSubmitters(message) {
  if (!twilioClient) return { ok: false, reason: 'twilio_not_configured' };
  try {
    let feedbackList = [];
    if (dbPool) {
      feedbackList = await query('SELECT * FROM feedback');
    } else {
      feedbackList = feedbacks;
    }
    const userIds = feedbackList.map(f => f.userId).filter(Boolean);
    let recipients = [];
    if (dbPool && userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const rows = await query(`SELECT phone FROM users WHERE username IN (${placeholders}) OR id IN (${placeholders})`, [...userIds, ...userIds]);
      recipients = rows.map(u => u.phone).filter(Boolean);
    }
    if (recipients.length === 0) {
      feedbackList.forEach(f => { if (f.phone) recipients.push(f.phone); });
    }
    if (recipients.length === 0) {
      recipients = users.filter(u => u.phone).map(u => u.phone);
    }
    const results = await Promise.allSettled(recipients.map(p => twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: p })));
    return { ok: true, results, recipientsCount: recipients.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

let twilioClient = null;
const TWILIO_ACCOUNT = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
if (TWILIO_ACCOUNT && TWILIO_AUTH && TWILIO_FROM) {
  try {
    const Twilio = require('twilio');
    twilioClient = new Twilio(TWILIO_ACCOUNT, TWILIO_AUTH);
    console.log('Twilio client configured');
  } catch (e) {
    console.warn('Twilio package not available or failed to initialize:', e.message);
  }
}

async function sendSmsToAll(message) {
  if (!twilioClient) return { ok: false, reason: 'twilio_not_configured' };
  try {
    let recipients = [];
    if (dbPool) {
      const rows = await query('SELECT phone FROM users WHERE phone != ""');
      recipients = rows.map(u => u.phone).filter(Boolean);
    }
    if (recipients.length === 0) {
      recipients = users.filter(u => u.phone).map(u => u.phone);
    }
    const results = await Promise.allSettled(recipients.map(p => twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: p })));
    return { ok: true, results, recipientsCount: recipients.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendSmsToRole(role, message) {
  if (!twilioClient) return { ok: false, reason: 'twilio_not_configured' };
  try {
    let recipients = [];
    if (dbPool) {
      const rows = await query('SELECT phone FROM users WHERE role = ? AND phone != ""', [role]);
      recipients = rows.map(u => u.phone).filter(Boolean);
    }
    if (recipients.length === 0) {
      recipients = users.filter(u => u.role === role && u.phone).map(u => u.phone);
    }
    const results = await Promise.allSettled(recipients.map(p => twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: p })));
    return { ok: true, results, recipientsCount: recipients.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendSmsToUserIds(userIds, message) {
  if (!twilioClient) return { ok: false, reason: 'twilio_not_configured' };
  try {
    let recipients = [];
    if (dbPool && userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const rows = await query(`SELECT phone FROM users WHERE id IN (${placeholders}) OR username IN (${placeholders})`, [...userIds, ...userIds]);
      recipients = rows.map(u => u.phone).filter(Boolean);
    }
    if (recipients.length === 0) {
      recipients = users.filter(u => userIds.includes(String(u.id)) || userIds.includes(u.username)).map(u => u.phone);
    }
    const results = await Promise.allSettled(recipients.map(p => twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: p })));
    return { ok: true, results, recipientsCount: recipients.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendSmsToPhones(phones, message) {
  if (!twilioClient) return { ok: false, reason: 'twilio_not_configured' };
  try {
    const recipients = (phones || []).map(p => String(p).trim()).filter(Boolean);
    const results = await Promise.allSettled(recipients.map(p => twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: p })));
    return { ok: true, results, recipientsCount: recipients.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

app.get('/api/users', async (req, res) => {
  try {
    let all = [];
    if (dbPool) {
      all = await query('SELECT * FROM users');
    } else {
      all = users;
    }
    const unique = new Map();
    all.forEach((u) => {
      const user = dbPool ? normalizeUserRow(u) : u;
      const role = user.role || (user.username === 'admin' ? 'admin' : /^cafstaff/i.test(user.username) ? 'staff' : 'student');
      const existing = unique.get(user.username);
      const priority = role === 'admin' ? 3 : role === 'staff' ? 2 : 1;
      const existingPriority = existing ? (existing.role === 'admin' ? 3 : existing.role === 'staff' ? 2 : 1) : 0;
      if (!existing || priority > existingPriority) {
        unique.set(user.username, {
          id: user.id,
          username: user.username,
          role,
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          fingerprintId: user.fingerprintId || '',
          responsibility: user.responsibility || 'member',
          universityID: user.universityID || '',
          department: user.department || '',
          active: user.active !== undefined ? user.active : true
        });
      }
    });
    return res.json({ success: true, users: Array.from(unique.values()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, role, fullName, email, phone, phoneNumber, fingerprintId, responsibility, universityID, department, active } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  if (String(role).toLowerCase() === 'admin' && (process.env.NODE_ENV || 'development') === 'production') {
    const adminHeader = req.headers['x-admin'];
    const auth = req.headers.authorization || '';
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
    if (String(adminHeader) !== 'true' && auth !== `Bearer ${ADMIN_TOKEN}`) {
      return res.status(403).json({ success: false, message: 'Admin privileges required' });
    }
  }
  try {
    if (dbPool) {
      if (email && email.trim()) {
        const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.trim()]);
        if (existing.length) return res.status(400).json({ success: false, message: 'Email already registered' });
      }
      const [result] = await dbPool.execute(
        'INSERT INTO users (username, password, role, fullName, email, phone, fingerprintId, responsibility, universityID, department, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, password || '', role || 'student', fullName || '', email || '', phone || phoneNumber || '', fingerprintId || '', responsibility || 'member', universityID || '', department || '', active !== undefined ? active : true]
      );
      return res.json({ success: true, user: { id: result.insertId, username, role: role || 'student', phone: phone || phoneNumber || '', fingerprintId: fingerprintId || '', responsibility: responsibility || 'member' } });
    }
    const newUser = { id: users.length + 1, username, password: password || '', role: role || 'student', email: email || '', phone: phone || phoneNumber || '', fingerprintId: fingerprintId || '', responsibility: responsibility || 'member' };
    users.push(newUser);
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/register-first', async (req, res) => {
  try {
    const { username, password, fullName, email, phone } = req.body;
    let count = 0;
    if (dbPool) {
      const rows = await query('SELECT COUNT(*) as count FROM users');
      count = rows[0].count;
    } else {
      count = users.length;
    }
    if (count > 0) return res.status(403).json({ success: false, message: 'First-time registration is closed' });
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO users (username, password, role, fullName, email, phone) VALUES (?, ?, ?, ?, ?, ?)', [username, password || '', 'admin', fullName || '', email || '', phone || '']);
      return res.json({ success: true, user: { id: result.insertId, username, role: 'admin' } });
    }
    const newUser = { id: users.length + 1, username, password: password || '', role: 'admin', email: email || '', phone: phone || '' };
    users.push(newUser);
    return res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error('POST /api/register-first failed:', err && err.stack ? err.stack : err, 'body:', req.body);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', useAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, fullName, email, phone, phoneNumber, fingerprintId, responsibility, universityID, department, active } = req.body;
  try {
    if (dbPool) {
      const [result] = await dbPool.execute(
        'UPDATE users SET username = ?, password = ?, role = ?, fullName = ?, email = ?, phone = ?, fingerprintId = ?, responsibility = ?, universityID = ?, department = ?, active = ? WHERE id = ?',
        [username, password, role, fullName, email, phone || phoneNumber || '', fingerprintId, responsibility, universityID, department, active, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, user: { id: Number(id), username, role, fullName, universityID, phone: phone || phoneNumber || '', fingerprintId, responsibility: responsibility || 'member' } });
    }
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
    users[idx] = { ...users[idx], username, password, role, fullName, email, phone, fingerprintId, responsibility, universityID, department, active };
    res.json({ success: true, user: users[idx] });
  } catch (err) {
    console.error('PUT user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', useAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    if (dbPool) {
      const [result] = await dbPool.execute('DELETE FROM users WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true });
    }
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
    users.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    if (dbPool) {
      const menus = await query('SELECT * FROM menu');
      return res.json(menus.map(m => ({ id: m.id, mealType: m.mealType, item: m.item, time: m.time })));
    }
    res.json(menuItems);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/menu', useAdmin, async (req, res) => {
  try {
    const { mealType, item, time } = req.body;
    if (!item) return res.status(400).json({ success: false, message: 'Item required' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO menu (mealType, item, time) VALUES (?, ?, ?)', [mealType, item, time]);
      return res.json({ success: true, id: result.insertId });
    }
    const id = menuItems.length ? Math.max(...menuItems.map(m => m.id)) + 1 : 1;
    const newItem = { id, mealType, item, time };
    menuItems.push(newItem);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    if (dbPool) {
      const feedbackList = await query('SELECT * FROM feedback');
      return res.json(feedbackList.map(f => ({ id: f.id, rating: f.rating, comment: f.comment, userId: f.userId, createdAt: f.createdAt })));
    }
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { rating, comment, userId, sendSMSTarget } = req.body;
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO feedback (rating, comment, userId, createdAt) VALUES (?, ?, ?, ?)', [rating, comment, userId || '', new Date()]);
      const response = { success: true, id: result.insertId, createdAt: new Date() };
      if (sendSMSTarget) {
        let smsResult = null;
        if (sendSMSTarget.kind === 'all') smsResult = await sendSmsToAll(String(comment || ''));
        else if (sendSMSTarget.kind === 'submitters') smsResult = await sendSmsToFeedbackSubmitters(String(comment || ''));
        else if (sendSMSTarget.kind === 'role') smsResult = await sendSmsToRole(sendSMSTarget.role, String(comment || ''));
        else if (sendSMSTarget.kind === 'users') smsResult = await sendSmsToUserIds(sendSMSTarget.userIds || [], String(comment || ''));
        else if (sendSMSTarget.kind === 'phones') smsResult = await sendSmsToPhones(sendSMSTarget.phones || [], String(comment || ''));
        response.sms = smsResult;
      }
      return res.json(response);
    }
    const id = feedbacks.length ? Math.max(...feedbacks.map(f => f.id)) + 1 : 1;
    const createdAt = new Date().toISOString();
    const fb = { id, rating: rating || null, comment: comment || '', userId: userId || null, createdAt };
    feedbacks.push(fb);
    const response = { success: true, id, createdAt };
    if (sendSMSTarget) {
      let smsResult = null;
      if (sendSMSTarget.kind === 'all') smsResult = await sendSmsToAll(String(comment || ''));
      else if (sendSMSTarget.kind === 'submitters') smsResult = await sendSmsToFeedbackSubmitters(String(comment || ''));
      else if (sendSMSTarget.kind === 'role') smsResult = await sendSmsToRole(sendSMSTarget.role, String(comment || ''));
      else if (sendSMSTarget.kind === 'users') smsResult = await sendSmsToUserIds(sendSMSTarget.userIds || [], String(comment || ''));
      else if (sendSMSTarget.kind === 'phones') smsResult = await sendSmsToPhones(sendSMSTarget.phones || [], String(comment || ''));
      response.sms = smsResult;
    }
    return res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/feedback/admin', useAdmin, async (req, res) => {
  try {
    const { rating, comment, userId, notifyTo } = req.body;
    const createdAt = new Date();
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO feedback (rating, comment, userId, createdAt) VALUES (?, ?, ?, ?)', [rating, comment, userId || '', createdAt]);
      const noteMsg = `New feedback added by admin: ${String(comment || '').substring(0, 120)}`;
      await dbPool.execute('INSERT INTO notifications (message, `to`, date) VALUES (?, ?, ?)', [noteMsg, notifyTo || 'staff', createdAt]);
      return res.json({ success: true, id: result.insertId, createdAt });
    }
    const id = feedbacks.length ? Math.max(...feedbacks.map(f => f.id)) + 1 : 1;
    const createdAtStr = createdAt.toISOString();
    feedbacks.push({ id, rating: rating || null, comment: comment || '', userId: userId || null, createdAt: createdAtStr });
    const noteId = notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1;
    notifications.push({ id: noteId, message: `New feedback added by admin: ${String(comment || '').substring(0,120)}`, to: notifyTo || 'staff', date: createdAtStr });
    return res.json({ success: true, id, createdAt: createdAtStr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/feedback/:id', useAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, userId } = req.body;
    if (dbPool) {
      const [result] = await dbPool.execute('UPDATE feedback SET rating = ?, comment = ?, userId = ? WHERE id = ?', [rating, comment, userId || '', id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Feedback not found' });
      return res.json({ success: true, id: Number(id) });
    }
    const idx = feedbacks.findIndex(f => String(f.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Feedback not found' });
    feedbacks[idx] = { ...feedbacks[idx], rating: rating !== undefined ? rating : feedbacks[idx].rating, comment: comment !== undefined ? comment : feedbacks[idx].comment, userId: userId !== undefined ? userId : feedbacks[idx].userId };
    return res.json({ success: true, id: feedbacks[idx].id, createdAt: feedbacks[idx].createdAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/feedback/:id', useAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (dbPool) {
      const [result] = await dbPool.execute('DELETE FROM feedback WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Feedback not found' });
      return res.json({ success: true });
    }
    const idx = feedbacks.findIndex(f => String(f.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Feedback not found' });
    feedbacks.splice(idx, 1);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/replies', async (req, res) => {
  try {
    const { parentType, parentId } = req.query;
    if (!parentType || !parentId) return res.status(400).json({ success: false, message: 'Missing parentType or parentId' });
    if (dbPool) {
      const matched = await query('SELECT * FROM replies WHERE parentType = ? AND parentId = ?', [parentType, parentId]);
      return res.json({ success: true, replies: matched.map(r => ({ id: r.id, parentType: r.parentType, parentId: r.parentId, text: r.text, createdAt: r.createdAt })) });
    }
    const matched = replies.filter(r => r.parentType === parentType && String(r.parentId) === String(parentId));
    return res.json({ success: true, replies: matched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/replies', useAdmin, async (req, res) => {
  try {
    const { parentType, parentId, text, sendSMSTarget } = req.body;
    if (!parentType || !parentId || !text) return res.status(400).json({ success: false, message: 'Missing fields' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO replies (parentType, parentId, text, createdAt) VALUES (?, ?, ?, ?)', [parentType, parentId, text, new Date()]);
      const response = { success: true, id: result.insertId, createdAt: new Date() };
      if (sendSMSTarget) {
        let smsResult = null;
        if (sendSMSTarget.kind === 'all') smsResult = await sendSmsToAll(text);
        else if (sendSMSTarget.kind === 'submitters') smsResult = await sendSmsToFeedbackSubmitters(text);
        else if (sendSMSTarget.kind === 'role') smsResult = await sendSmsToRole(sendSMSTarget.role, text);
        else if (sendSMSTarget.kind === 'users') smsResult = await sendSmsToUserIds(sendSMSTarget.userIds || [], text);
        else if (sendSMSTarget.kind === 'phones') smsResult = await sendSmsToPhones(sendSMSTarget.phones || [], text);
        response.sms = smsResult;
      }
      return res.json(response);
    }
    const id = replies.length ? Math.max(...replies.map(r => r.id)) + 1 : 1;
    const reply = { id, parentType, parentId, text, createdAt: new Date().toISOString() };
    replies.push(reply);
    const response = { success: true, id, createdAt: reply.createdAt };
    if (sendSMSTarget) {
      let smsResult = null;
      if (sendSMSTarget.kind === 'all') smsResult = await sendSmsToAll(text);
      else if (sendSMSTarget.kind === 'submitters') smsResult = await sendSmsToFeedbackSubmitters(text);
      else if (sendSMSTarget.kind === 'role') smsResult = await sendSmsToRole(sendSMSTarget.role, text);
      else if (sendSMSTarget.kind === 'users') smsResult = await sendSmsToUserIds(sendSMSTarget.userIds || [], text);
      else if (sendSMSTarget.kind === 'phones') smsResult = await sendSmsToPhones(sendSMSTarget.phones || [], text);
      response.sms = smsResult;
    }
    return res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/lost-id', async (req, res) => {
  try {
    const { studentId, name, phone, email, mauAccount, paymentRef, reason } = req.body;
    if (!studentId && !name) return res.status(400).json({ success: false, message: 'studentId or name required' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO lost_ids (studentId, name, phone, email, mauAccount, paymentRef, reason, reportedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [studentId || '', name || '', phone || '', email || '', mauAccount || '', paymentRef || '', reason || '', new Date()]);
      const note = `Lost ID reported: ${studentId || name}`;
      await dbPool.execute('INSERT INTO notifications (message, `to`, date) VALUES (?, ?, ?)', [note, 'admin', new Date()]);
      return res.json({ success: true, id: result.insertId, reportedAt: new Date() });
    }
    const id = lostIdReports.length ? Math.max(...lostIdReports.map(r => r.id)) + 1 : 1;
    const entry = { id, studentId: studentId || '', name: name || '', phone: phone || '', email: email || '', mauAccount: mauAccount || '', paymentRef: paymentRef || '', reason: reason || '', status: 'reported', reportedAt: new Date().toISOString() };
    lostIdReports.push(entry);
    const note = `Lost ID reported: ${entry.studentId || entry.name}`;
    const nid = notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1;
    notifications.push({ id: nid, message: note, to: 'admin', date: new Date().toISOString() });
    return res.json({ success: true, id, reportedAt: entry.reportedAt });
  } catch (err) {
    console.error('POST /api/lost-id failed:', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/lost-id', useAdmin, async (req, res) => {
  try {
    if (dbPool) {
      const list = await query('SELECT * FROM lost_ids ORDER BY reportedAt DESC');
      return res.json(list.map(l => ({ id: l.id, studentId: l.studentId, name: l.name, phone: l.phone, email: l.email, mauAccount: l.mauAccount, paymentRef: l.paymentRef, reason: l.reason, status: l.status, adminNote: l.adminNote, reportedAt: l.reportedAt })));
    }
    return res.json([...lostIdReports].reverse());
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/lost-id/:id', useAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    if (dbPool) {
      const [result] = await dbPool.execute('UPDATE lost_ids SET status = ?, adminNote = ? WHERE id = ?', [status, adminNote, id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true, id: Number(id) });
    }
    const idx = lostIdReports.findIndex(r => String(r.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
    lostIdReports[idx] = { ...lostIdReports[idx], status: status || lostIdReports[idx].status, adminNote: adminNote || lostIdReports[idx].adminNote };
    res.json({ success: true, id: lostIdReports[idx].id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'all';
    const userId = req.headers['x-user-id'] || '';
    let notes = [];
    if (dbPool) {
      notes = await query('SELECT * FROM notifications');
    } else {
      notes = notifications;
    }
    const filtered = notes.filter(n => {
      const to = n.to || 'all';
      return to === 'all' || to === userRole || to === userId;
    });
    return res.json({
      success: true,
      notifications: filtered.map(n => ({ id: n.id, message: n.message, to: n.to, date: n.date, read: n.read || false }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/notifications', useAdmin, async (req, res) => {
  try {
    const { message, to } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO notifications (message, `to`, date) VALUES (?, ?, ?)', [message, to || 'all', new Date()]);
      return res.json({ success: true, id: result.insertId });
    }
    const id = notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1;
    notifications.push({ id, message, to: to || 'all', date: new Date().toISOString(), read: false });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('POST /api/notifications failed:', err && err.stack ? err.stack : err, 'requestBody:', req.body);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/notifications/:id', useAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (dbPool) {
      const [result] = await dbPool.execute('DELETE FROM notifications WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true });
    }
    const idx = notifications.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
    notifications.splice(idx, 1);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/notifications/:id/read', useAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (dbPool) {
      const [result] = await dbPool.execute('UPDATE notifications SET `read` = TRUE WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true });
    }
    const idx = notifications.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
    notifications[idx].read = true;
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    if (dbPool) {
      const configs = await query('SELECT * FROM config');
      return res.json(configs.map(c => ({ id: c.id, key: c.key, value: parseJson(c.value) })));
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ success: false, message: 'Config key required' });
    if (!dbPool) return res.status(500).json({ success: false, message: 'Config model not available' });
    const valueText = JSON.stringify(req.body.value || {});
    await dbPool.execute('INSERT INTO config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [key, valueText]);
    const [row] = await query('SELECT * FROM config WHERE `key` = ? LIMIT 1', [key]);
    return res.json({ success: true, config: { id: row[0].id, key: row[0].key, value: parseJson(row[0].value) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    if (dbPool) {
      const items = await query('SELECT * FROM inventory');
      return res.json(items.map(i => ({ id: i.id, name: i.name || i.item, quantity: i.quantity, measurement: i.measurement, quality: i.quality, status: i.status })));
    }
    const normalized = inventory.map(i => ({ id: i.id, name: i.name || i.item, quantity: i.quantity, measurement: i.measurement || 'piece', quality: i.quality || 'Good', status: i.status || (i.quantity > 0 ? 'Available' : 'Out of Stock') }));
    return res.json(normalized);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory', useAdmin, async (req, res) => {
  try {
    const { name, item, quantity, measurement, quality, status } = req.body;
    const itemName = name || item;
    if (!itemName) return res.status(400).json({ success: false, message: 'Item name required' });
    if (dbPool) {
      const [result] = await dbPool.execute('INSERT INTO inventory (name, item, quantity, measurement, quality, status) VALUES (?, ?, ?, ?, ?, ?)', [itemName, itemName, Number(quantity) || 0, measurement || 'piece', quality || 'Good', status || 'Available']);
      return res.json({ success: true, id: result.insertId });
    }
    const id = inventory.length ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
    const it = { id, name: itemName, quantity: Number(quantity) || 0, measurement, quality, status };
    inventory.push(it);
    return res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/inventory/:id', useAdmin, async (req, res) => {
  try {
    if (dbPool) {
      const [result] = await dbPool.execute('UPDATE inventory SET name = ?, item = ?, quantity = ?, measurement = ?, quality = ?, status = ? WHERE id = ?', [req.body.name || req.body.item, req.body.name || req.body.item, Number(req.body.quantity) || 0, req.body.measurement || 'piece', req.body.quality || 'Good', req.body.status || 'Available', req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true });
    }
    const id = Number(req.params.id);
    const idx = inventory.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
    inventory[idx] = { ...inventory[idx], ...req.body, name: req.body.name || req.body.item || inventory[idx].name };
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/inventory/:id', useAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (dbPool) {
      const [result] = await dbPool.execute('DELETE FROM inventory WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true });
    }
    const idx = inventory.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
    inventory.splice(idx, 1);
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/:id failed:', err && err.stack ? err.stack : err);
    res.status(500).json({ success: false, message: err.message });
  }
});

async function handleLogin(req, res) {
  const usernameRaw = String(req.body.username || '').trim();
  const passwordRaw = String(req.body.password || '').trim();
  if (!usernameRaw) return res.status(400).json({ success: false, message: 'Username required' });
  if (!passwordRaw) return res.status(400).json({ success: false, message: 'Password required' });
  try {
    if (dbPool) {
      const rows = await query('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [usernameRaw, usernameRaw]);
      let user = rows[0];
      if (!user) {
        if (/^(mau|2024)/i.test(usernameRaw)) {
          const [result] = await dbPool.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [usernameRaw, passwordRaw || 'password123', 'student']);
          user = { id: result.insertId, username: usernameRaw, role: 'student', password: passwordRaw || 'password123' };
        } else {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
      }
      if (user.password && String(user.password).trim() !== passwordRaw) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      const effectiveRole = user.role || (user.username === 'admin' ? 'admin' : /^cafstaff/i.test(user.username) ? 'staff' : 'student');
      return res.json({ success: true, user: { id: user.id, username: user.username, role: effectiveRole } });
    }

    const found = users.find(u => (
      (String(u.username).toLowerCase() === usernameRaw.toLowerCase() || String(u.email).toLowerCase() === usernameRaw.toLowerCase()) &&
      String(u.password).trim() === passwordRaw
    ));
    if (!found) {
      if (/^(mau|2024)/i.test(usernameRaw) && usernameRaw.length >= 7) {
        const newUser = { id: users.length + 1, username: usernameRaw, password: passwordRaw || 'password123', role: 'student' };
        users.push(newUser);
        return res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const effectiveRole = found.role || (found.username === 'admin' ? 'admin' : /^cafstaff/i.test(found.username) ? 'staff' : 'student');
    return res.json({ success: true, user: { id: found.id, username: found.username, role: effectiveRole } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);
app.post('/auth/login', handleLogin);

app.get('/api/rfid/data', (req, res) => {
  res.json({
    success: true,
    data: {
      device_id: 'RFID-MYSQL-001',
      status: 'standby',
      last_scan: new Date().toISOString(),
      total_tags: 0,
      active_tags: 0,
      reader_version: 'local',
      signal_strength: '100%',
      device_name: 'Local RFID Gateway',
      location: 'Asset Management Office',
      temperature: 'N/A',
      last_reader: 'Local API',
      firmware_version: 'N/A'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/departments', async (req, res) => {
  try {
    const departments = dbPool
      ? await query('SELECT id, name, description FROM departments ORDER BY name')
      : [];
    return res.json({ success: true, departments });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = dbPool
      ? await query('SELECT id, name, description FROM categories ORDER BY name')
      : [];
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/maintenance', (req, res) => {
  res.json({ success: true, requests: [] });
});

app.get('/api/rfid/logs', (req, res) => {
  res.json({ success: true, logs: [] });
});

app.get('/api/assignments', (req, res) => {
  res.json({ success: true, assignments: [] });
});

app.get('/api/audit', (req, res) => {
  res.json({ success: true, logs: [] });
});

app.get('/api/settings', async (req, res) => {
  try {
    if (dbPool) {
      const rows = await query('SELECT `value` FROM config WHERE `key` = ? LIMIT 1', ['settings']);
      if (rows.length > 0) return res.json({ success: true, settings: parseJson(rows[0].value) });
    }
    return res.json({
      success: true,
      settings: {
        system_name: 'Smart University Asset Management System',
        maintenance_mode: false,
        auto_backup: true,
        backup_frequency: 'daily',
        notification_email: ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/backups', (req, res) => {
  const backupDir = path.join(__dirname, 'backups');
  const backups = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).map((filename) => {
        const filePath = path.join(backupDir, filename);
        const stats = fs.statSync(filePath);
        return { filename, size: stats.size, createdAt: stats.birthtime.toISOString() };
      })
    : [];
  res.json({ success: true, backups });
});

app.get('/api/assets', async (req, res) => {
  try {
    if (dbPool) {
      const rows = await query('SELECT * FROM assets');
      return res.json({ success: true, assets: rows, pagination: { pages: 1, total: rows.length } });
    }
    return res.json({ success: true, assets, pagination: { pages: 1, total: assets.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbPool) {
      const rows = await query('SELECT * FROM assets WHERE id = ?', [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Asset not found' });
      return res.json(rows[0]);
    }
    const asset = assets.find(a => String(a.id) === String(id));
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    return res.json(asset);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    if (dbPool) {
      const sets = Object.keys(updateFields).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(updateFields);
      if (!sets) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }
      await dbPool.execute(`UPDATE assets SET ${sets} WHERE id = ?`, [...values, id]);
      const rows = await query('SELECT * FROM assets WHERE id = ?', [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Asset not found' });
      return res.json(rows[0]);
    }
    const assetIndex = assets.findIndex(a => String(a.id) === String(id));
    if (assetIndex === -1) return res.status(404).json({ success: false, message: 'Asset not found' });
    assets[assetIndex] = { ...assets[assetIndex], ...updateFields };
    return res.json(assets[assetIndex]);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbPool) {
      const [result] = await dbPool.execute('DELETE FROM assets WHERE id = ?', [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Asset not found' });
      return res.json({ success: true });
    }
    const index = assets.findIndex(a => String(a.id) === String(id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Asset not found' });
    assets.splice(index, 1);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/assets', async (req, res) => {
  try {
    const {
      name, category, description, serial_number, asset_code, rfid_tag,
      status, condition, department, location, purchase_date, purchase_price,
      supplier, manufacturer, model, warranty_expiry, notes, current_value,
      health_score, created_by, created_at, image
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Name and category are required' });
    }

    if (dbPool) {
      const [result] = await dbPool.execute(
        `INSERT INTO assets (
          name, category, description, serial_number, asset_code, rfid_tag,
          status, \`condition\`, department, location, purchase_date, purchase_price,
          supplier, manufacturer, model, warranty_expiry, notes, current_value,
          health_score, created_by, createdAt, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name || '', category || '', description || '', serial_number || '', asset_code || '', rfid_tag || '',
          status || 'available', condition || 'Good', department || '', location || '', purchase_date || null,
          Number(purchase_price) || 0, supplier || '', manufacturer || '', model || '', warranty_expiry || null,
          notes || '', Number(current_value) || 0, Number(health_score) || 100, Number(created_by) || 0,
          created_at || new Date(), image || null
        ]
      );
      const newAsset = {
        id: result.insertId,
        name, category, description, serial_number, asset_code, rfid_tag,
        status: status || 'available', condition: condition || 'Good', department: department || '',
        location: location || '', purchase_date: purchase_date || null,
        purchase_price: Number(purchase_price) || 0, supplier: supplier || '', manufacturer: manufacturer || '',
        model: model || '', warranty_expiry: warranty_expiry || null, notes: notes || '',
        current_value: Number(current_value) || 0, health_score: Number(health_score) || 100,
        created_by: Number(created_by) || 0, createdAt: created_at || new Date(), image: image || null
      };
      return res.json(newAsset);
    }

    const newAsset = {
      id: assets.length + 1,
      name: name || '',
      category: category || '',
      description: description || '',
      serial_number: serial_number || '',
      asset_code: asset_code || '',
      rfid_tag: rfid_tag || '',
      status: status || 'available',
      condition: condition || 'Good',
      department: department || '',
      location: location || '',
      purchase_date: purchase_date || null,
      purchase_price: Number(purchase_price) || 0,
      supplier: supplier || '',
      manufacturer: manufacturer || '',
      model: model || '',
      warranty_expiry: warranty_expiry || null,
      notes: notes || '',
      current_value: Number(current_value) || 0,
      health_score: Number(health_score) || 100,
      created_by: Number(created_by) || 0,
      createdAt: created_at || new Date(),
      image: image || null
    };
    assets.push(newAsset);
    return res.json(newAsset);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate asset code or tag detected' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

function tryServeStatic() {
  const buildDir = path.join(__dirname, 'build');
  if (fs.existsSync(buildDir)) {
    app.use(express.static(buildDir));
    app.get(/.*/, (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).end();
      res.sendFile(path.join(buildDir, 'index.html'));
    });
    console.log('Configured static serving for React build.');
  }
}

(async () => {
  await tryConnectMySQL();
  tryServeStatic();
  app.get('/api/ping', (req, res) => res.json({ ok: true, timestamp: Date.now(), pid: process.pid }));
  const http = require('http');
  const server = http.createServer({ maxHeaderSize: 16 * 1024 }, app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
})();
