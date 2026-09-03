const http = require('http');
const url = require('url');

// In-memory database
const users = [];
let currentSession = null;

// Validation functions
const validators = {
  validateAdmin: (user) => {
    const errors = [];
    if (!user.username || user.username !== 'admin') {
      errors.push('Admin username must be "admin"');
    }
    if (!user.password || user.password.length < 6) {
      errors.push('Admin password must be at least 6 characters');
    }
    if (!user.email || !user.email.includes('@')) {
      errors.push('Admin email is required and must be valid');
    }
    return { valid: errors.length === 0, errors };
  },

  validateStaff: (user) => {
    const errors = [];
    if (!user.username || user.username.length < 4) {
      errors.push('Staff username must be at least 4 characters');
    }
    if (!user.password || user.password.length < 6) {
      errors.push('Staff password must be at least 6 characters');
    }
    if (!user.email || !user.email.includes('@')) {
      errors.push('Staff email is required and must be valid');
    }
    return { valid: errors.length === 0, errors };
  },

  validateStudent: (user) => {
    const errors = [];
    const usernameRegex = /^mau\d{6}$/i;
    if (!usernameRegex.test(user.username)) {
      errors.push('Student username must start with "MAU" followed by exactly 6 digits');
    }
    if (!user.password || user.password.length < 6) {
      errors.push('Student password must be at least 6 characters');
    }
    if (user.email && user.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        errors.push('Email format is invalid');
      }
    }
    return { valid: errors.length === 0, errors };
  }
};

// Check if user is admin
const isAdmin = (session) => {
  return session && session.role === 'admin';
};

// Register user (admin only)
const registerUser = (userData, session) => {
  if (!isAdmin(session)) {
    return { success: false, message: 'Only admin can register new users' };
  }

  const { username, password, email, role } = userData;
  
  // Check if user already exists
  if (users.find(u => u.username === username)) {
    return { success: false, message: 'Username already exists' };
  }

  let validation;
  switch(role) {
    case 'admin':
      validation = validators.validateAdmin({ username, password, email, role });
      break;
    case 'staff':
      validation = validators.validateStaff({ username, password, email, role });
      break;
    case 'student':
      validation = validators.validateStudent({ username, password, email, role });
      break;
    default:
      return { success: false, message: 'Invalid role' };
  }

  if (!validation.valid) {
    return { success: false, message: 'Validation failed', errors: validation.errors };
  }

  users.push({ username, password, email, role });
  return { success: true, message: `${role} registered successfully` };
};

// Login user
const loginUser = (username, password) => {
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    currentSession = { username: user.username, role: user.role };
    return { success: true, role: user.role, message: 'Login successful' };
  }
  return { success: false, message: 'Invalid credentials' };
};

// Get dashboard based on role
const getDashboard = (session) => {
  if (!session) {
    return { success: false, message: 'Not logged in' };
  }

  switch(session.role) {
    case 'admin':
      return {
        success: true,
        dashboard: {
          title: 'Admin Dashboard',
          welcome: `Welcome Admin ${session.username}`,
          permissions: ['Manage Users', 'View Reports', 'System Settings'],
          users: users.map(u => ({ username: u.username, role: u.role, email: u.email }))
        }
      };
    case 'staff':
      return {
        success: true,
        dashboard: {
          title: 'Asset Management Staff Dashboard',
          welcome: `Welcome Staff ${session.username}`,
          permissions: ['Manage Assets', 'View Inventory', 'Process Requests']
        }
      };
    case 'student':
      return {
        success: true,
        dashboard: {
          title: 'Student Dashboard',
          welcome: `Welcome Student ${session.username}`,
          permissions: ['View Menu', 'Place Orders', 'Give Feedback']
        }
      };
    default:
      return { success: false, message: 'Unknown role' };
  }
};

// Logout
const logout = () => {
  currentSession = null;
  return { success: true, message: 'Logged out successfully' };
};

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      
      // Register endpoint (admin only)
      if (parsedUrl.pathname === '/api/register' && method === 'POST') {
        const result = registerUser(data, currentSession);
        res.writeHead(result.success ? 200 : 403);
        res.end(JSON.stringify(result));
      }
      // Login endpoint
      else if (parsedUrl.pathname === '/api/login' && method === 'POST') {
        const result = loginUser(data.username, data.password);
        res.writeHead(result.success ? 200 : 401);
        res.end(JSON.stringify(result));
      }
      // Dashboard endpoint
      else if (parsedUrl.pathname === '/api/dashboard' && method === 'GET') {
        const result = getDashboard(currentSession);
        res.writeHead(result.success ? 200 : 401);
        res.end(JSON.stringify(result));
      }
      // Logout endpoint
      else if (parsedUrl.pathname === '/api/logout' && method === 'POST') {
        const result = logout();
        res.writeHead(200);
        res.end(JSON.stringify(result));
      }
      // Get all users (admin only)
      else if (parsedUrl.pathname === '/api/users' && method === 'GET') {
        if (isAdmin(currentSession)) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, users: users.map(u => ({ username: u.username, role: u.role, email: u.email })) }));
        } else {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, message: 'Admin access required' }));
        }
      }
      else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: 'Server error' }));
    }
  });
});

// Initialize with admin user
const initializeAdmin = () => {
  const adminUser = {
    username: 'admin',
    password: 'admin123',
    email: 'admin@assetmanagement.local',
    role: 'admin'
  };
  users.push(adminUser);
  console.log(' Admin user created: admin/admin123');
};

server.listen(3002, () => {
  initializeAdmin();
  console.log(' Server running on http://localhost:3002');
});