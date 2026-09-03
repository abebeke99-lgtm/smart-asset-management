// ==============================================
// server.js - COMPLETE BACKEND API
// ==============================================

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// ==========================================
// MYSQL DATABASE CONNECTION
// ==========================================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_asset_management'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ MySQL Connection Error:', err.message);
    console.log('⚠️ Please check:');
    console.log('   1. XAMPP MySQL is running');
    console.log('   2. Database name is correct');
    console.log('   3. Username/password are correct');
    return;
  }
  console.log('✅ MySQL Connected Successfully');
  console.log(`📊 Database: ${process.env.DB_NAME || 'smart_asset_management'}`);
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
  db.query('SELECT 1 as connected', (err, results) => {
    if (err) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Database connection failed',
        error: err.message
      });
    }
    res.json({
      status: 'OK',
      message: 'Server is running',
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Login - supports username OR email
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username/Email and password are required'
    });
  }

  // Query using username OR email
  db.query(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, results) => {
      if (err) {
        console.error('Login query error:', err);
        return res.status(500).json({ 
          success: false,
          message: 'Database error', 
          error: err.message 
        });
      }
      
      if (results.length === 0) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid username or password' 
        });
      }

      const user = results[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({ 
          success: false,
          message: 'Account is deactivated. Please contact administrator.' 
        });
      }

      // Compare password
      let isMatch = false;
      try {
        // If password is not hashed (for demo users), compare directly
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(password, user.password);
        } else {
          // For demo users with plain text password
          isMatch = (password === user.password);
        }
      } catch (error) {
        console.error('Password compare error:', error);
        isMatch = (password === user.password);
      }

      if (!isMatch) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid username or password' 
        });
      }

      // Update last login
      db.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id],
        (err) => { if (err) console.error('Error updating last login:', err); }
      );

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Log login activity
      db.query(
        `INSERT INTO audit_logs 
         (user_id, username, user_role, action, module, status, ip_address, user_agent) 
         VALUES (?, ?, ?, 'LOGIN', 'Auth', 'Success', ?, ?)`,
        [user.id, user.username, user.role, req.ip || 'unknown', req.headers['user-agent'] || 'unknown'],
        (err) => { if (err) console.error('Error logging login:', err); }
      );

      // Return user data (excluding password)
      const { password: _, ...userData } = user;
      res.json({ 
        success: true,
        token, 
        user: userData 
      });
    }
  );
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    db.query(
      `SELECT id, username, email, full_name, role, department, phone_number, is_active, last_login 
       FROM users WHERE id = ?`,
      [decoded.id],
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        if (results.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user: results[0] });
      }
    );
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, full_name, role, department, phone_number } = req.body;

  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ 
      success: false,
      message: 'Username, email, password, and full name are required' 
    });
  }

  // Check if user exists
  db.query(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ 
          success: false,
          message: 'Database error' 
        });
      }
      if (results.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Username or email already exists' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        `INSERT INTO users 
         (username, email, password, full_name, role, department, phone_number, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [username, email, hashedPassword, full_name, role || 'staff', department || null, phone_number || null],
        (err, result) => {
          if (err) {
            return res.status(500).json({ 
              success: false,
              message: 'Database error' 
            });
          }
          res.status(201).json({ 
            success: true,
            message: 'User registered successfully',
            userId: result.insertId
          });
        }
      );
    }
  );
});

// Change password
app.put('/api/auth/change-password', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { currentPassword, newPassword } = req.body;

    // Get user
    db.query(
      'SELECT * FROM users WHERE id = ?',
      [decoded.id],
      async (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];
        
        // Verify current password
        let isMatch = false;
        try {
          if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(currentPassword, user.password);
          } else {
            isMatch = (currentPassword === user.password);
          }
        } catch (error) {
          isMatch = (currentPassword === user.password);
        }

        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query(
          'UPDATE users SET password = ? WHERE id = ?',
          [hashedPassword, decoded.id],
          (err) => {
            if (err) {
              return res.status(500).json({ message: 'Database error' });
            }
            res.json({ success: true, message: 'Password changed successfully' });
          }
        );
      }
    );
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// ==========================================
// ASSET ROUTES
// ==========================================

// Get all assets
app.get('/api/assets', (req, res) => {
  const { page = 1, limit = 10, search, status, category, department } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = `
    SELECT a.*, 
           c.name as category_name, 
           d.name as department_name
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN departments d ON a.department_id = d.id
    WHERE a.is_deleted = 0
  `;
  
  const params = [];
  
  if (search) {
    query += ` AND (a.name LIKE ? OR a.asset_tag LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (status) {
    query += ` AND a.status = ?`;
    params.push(status);
  }
  
  if (category) {
    query += ` AND a.category_id = ?`;
    params.push(category);
  }
  
  if (department) {
    query += ` AND a.department_id = ?`;
    params.push(department);
  }
  
  query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  db.query(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    
    db.query(
      'SELECT COUNT(*) as total FROM assets WHERE is_deleted = 0',
      (err, countResult) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({
          assets: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / parseInt(limit))
          }
        });
      }
    );
  });
});

// Create asset
app.post('/api/assets', (req, res) => {
  const {
    name, description, category_id, department_id, serial_number,
    model, manufacturer, purchase_date, purchase_cost,
    warranty_expiry, location, notes
  } = req.body;
  
  const asset_tag = `AST-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  db.query(
    `INSERT INTO assets 
     (asset_tag, name, description, category_id, department_id, serial_number,
      model, manufacturer, purchase_date, purchase_cost, warranty_expiry, 
      location, notes, status, condition_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 'Good', 1)`,
    [asset_tag, name, description, category_id, department_id, serial_number,
     model, manufacturer, purchase_date, purchase_cost, warranty_expiry,
     location, notes],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Duplicate serial number or asset tag' });
        }
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({
        success: true,
        message: 'Asset created successfully',
        assetId: result.insertId,
        asset_tag
      });
    }
  );
});

// Get single asset
app.get('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  
  db.query(
    `SELECT a.*, 
            c.name as category_name, 
            d.name as department_name,
            u.full_name as assigned_to_name
     FROM assets a
     LEFT JOIN categories c ON a.category_id = c.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN users u ON a.assigned_to = u.id
     WHERE a.id = ? AND a.is_deleted = 0`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Asset not found' });
      }
      res.json({ asset: rows[0] });
    }
  );
});

// Update asset
app.put('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const fields = [];
  const values = [];
  
  const allowedFields = [
    'name', 'description', 'category_id', 'department_id', 'serial_number',
    'model', 'manufacturer', 'purchase_date', 'purchase_cost',
    'current_value', 'warranty_expiry', 'location', 'status', 'condition_status',
    'notes', 'rfid_tag'
  ];
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  });
  
  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }
  
  values.push(id);
  
  db.query(
    `UPDATE assets SET ${fields.join(', ')} WHERE id = ?`,
    values,
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'Asset updated successfully' });
    }
  );
});

// Delete asset (soft delete)
app.delete('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  
  db.query(
    'UPDATE assets SET is_deleted = 1, deleted_at = NOW() WHERE id = ?',
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'Asset deleted successfully' });
    }
  );
});

// Assign asset
app.post('/api/assets/:id/assign', (req, res) => {
  const { id } = req.params;
  const { assigned_to, expected_return_date } = req.body;
  
  db.query(
    `UPDATE assets 
     SET assigned_to = ?, is_assigned = 1, assigned_date = NOW(), 
         expected_return_date = ?, status = 'In-Use'
     WHERE id = ?`,
    [assigned_to, expected_return_date || null, id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'Asset assigned successfully' });
    }
  );
});

// Return asset
app.post('/api/assets/:id/return', (req, res) => {
  const { id } = req.params;
  
  db.query(
    `UPDATE assets 
     SET assigned_to = NULL, is_assigned = 0, assigned_date = NULL,
         expected_return_date = NULL, status = 'Available'
     WHERE id = ?`,
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'Asset returned successfully' });
    }
  );
});

// ==========================================
// MAINTENANCE ROUTES
// ==========================================

// Get maintenance requests
app.get('/api/maintenance', (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = `
    SELECT m.*, 
           a.name as asset_name, a.asset_tag,
           reporter.full_name as reported_by_name,
           assignee.full_name as assigned_to_name
    FROM maintenance_requests m
    LEFT JOIN assets a ON m.asset_id = a.id
    LEFT JOIN users reporter ON m.reported_by = reporter.id
    LEFT JOIN users assignee ON m.assigned_to = assignee.id
    WHERE m.is_deleted = 0
  `;
  
  const params = [];
  
  if (status) {
    query += ` AND m.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  db.query(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    
    db.query(
      'SELECT COUNT(*) as total FROM maintenance_requests WHERE is_deleted = 0',
      (err, countResult) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({
          requests: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / parseInt(limit))
          }
        });
      }
    );
  });
});

// Create maintenance request
app.post('/api/maintenance', (req, res) => {
  const { asset_id, type, priority, title, description, scheduled_date, estimated_cost } = req.body;
  
  const request_number = `MNT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  db.query(
    `INSERT INTO maintenance_requests 
     (request_number, asset_id, type, priority, title, description, 
      reported_by, scheduled_date, estimated_cost, status)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'Pending')`,
    [request_number, asset_id, type, priority, title, description, scheduled_date, estimated_cost],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      
      // Update asset status
      db.query(
        'UPDATE assets SET status = "Under-Maintenance" WHERE id = ?',
        [asset_id],
        (err) => { if (err) console.error('Error updating asset status:', err); }
      );
      
      res.status(201).json({
        success: true,
        message: 'Maintenance request created',
        requestId: result.insertId,
        request_number
      });
    }
  );
});

// Approve maintenance
app.put('/api/maintenance/:id/approve', (req, res) => {
  const { id } = req.params;
  
  db.query(
    `UPDATE maintenance_requests 
     SET status = 'Approved', approved_by = 1, approved_at = NOW()
     WHERE id = ?`,
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'Maintenance approved' });
    }
  );
});

// Complete maintenance
app.put('/api/maintenance/:id/complete', (req, res) => {
  const { id } = req.params;
  const { resolution, actual_cost, work_notes } = req.body;
  
  db.query(
    `UPDATE maintenance_requests 
     SET status = 'Completed', completion_date = NOW(), 
         resolution = ?, actual_cost = ?, work_notes = ?
     WHERE id = ?`,
    [resolution, actual_cost, work_notes, id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      
      // Update asset status back to available
      db.query(
        `UPDATE assets a
         JOIN maintenance_requests m ON m.asset_id = a.id
         SET a.status = 'Available'
         WHERE m.id = ?`,
        [id],
        (err) => { if (err) console.error('Error updating asset status:', err); }
      );
      
      res.json({ success: true, message: 'Maintenance completed' });
    }
  );
});

// ==========================================
// DEPARTMENT ROUTES
// ==========================================

app.get('/api/departments', (req, res) => {
  db.query('SELECT * FROM departments ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ departments: rows });
  });
});

app.post('/api/departments', (req, res) => {
  const { name, code, description } = req.body;
  db.query(
    'INSERT INTO departments (name, code, description) VALUES (?, ?, ?)',
    [name, code, description],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ success: true, id: result.insertId });
    }
  );
});

app.delete('/api/departments/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM departments WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ success: true, message: 'Department deleted' });
  });
});

// ==========================================
// CATEGORY ROUTES
// ==========================================

app.get('/api/categories', (req, res) => {
  db.query('SELECT * FROM categories ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ categories: rows });
  });
});

// ==========================================
// USER ROUTES
// ==========================================

app.get('/api/users', (req, res) => {
  db.query(
    `SELECT id, username, email, full_name, role, department, 
            phone_number, is_active, last_login, created_at
     FROM users ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ users: rows });
    }
  );
});

app.put('/api/users/:id/toggle-active', (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  
  db.query(
    'UPDATE users SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true, message: 'User status updated' });
    }
  );
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ success: true, message: 'User deleted' });
  });
});

// ==========================================
// NOTIFICATION ROUTES
// ==========================================

app.get('/api/notifications', (req, res) => {
  db.query(
    `SELECT * FROM notifications 
     WHERE recipient_id = 1 
     ORDER BY created_at DESC LIMIT 50`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ notifications: rows });
    }
  );
});

app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?',
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

app.put('/api/notifications/read-all', (req, res) => {
  db.query(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE recipient_id = 1',
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// ==========================================
// ASSIGNMENT ROUTES
// ==========================================

app.get('/api/assignments', (req, res) => {
  db.query(`
    SELECT a.id, a.asset_tag, a.name as asset_name, 
           a.assigned_date, a.expected_return_date,
           u.full_name as assigned_to_name, a.assigned_to, a.is_assigned
    FROM assets a
    LEFT JOIN users u ON a.assigned_to = u.id
    WHERE a.is_assigned = 1
    ORDER BY a.assigned_date DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ assignments: rows });
  });
});

// ==========================================
// RFID ROUTES
// ==========================================

app.get('/api/rfid/logs', (req, res) => {
  const { limit = 100 } = req.query;
  
  db.query(`
    SELECT r.*, a.name as asset_name, a.asset_tag
    FROM rfid_logs r
    LEFT JOIN assets a ON r.asset_id = a.id
    ORDER BY r.timestamp DESC
    LIMIT ?
  `, [parseInt(limit)], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ logs: rows });
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login: POST http://localhost:${PORT}/api/auth/login`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'smart_asset_management'}`);
});

module.exports = { app };