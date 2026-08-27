const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const { isValidEmail, isValidUsername } = require('../utils/validators');

const LOGIN_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict-officer', 'ict'],
  department_head: ['department_head', 'dept_head', 'department head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store-manager'],
  maintenance: ['maintenance'],
};

const normalizeLoginIdentity = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  const normalized = raw.toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [role, aliases] of Object.entries(LOGIN_ALIASES)) {
    if (aliases.some((alias) => normalizeAlias(alias) === normalized)) {
      return role;
    }
  }

  return normalized.replace(/\s+/g, '_');
};

const normalizeAlias = (value = '') => String(value || '').trim().toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s+/g, ' ').trim();

const resolveLoginAliases = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }

  const canonical = normalizeLoginIdentity(raw);
  const aliases = new Set([raw.toLowerCase(), canonical]);

  for (const [role, roleAliases] of Object.entries(LOGIN_ALIASES)) {
    if (role === canonical || roleAliases.some((alias) => normalizeAlias(alias) === normalizeAlias(raw))) {
      for (const alias of roleAliases) {
        aliases.add(alias);
        aliases.add(alias.toLowerCase());
      }
    }
  }

  return [...aliases].filter(Boolean);
};

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role, email: user.email },
  process.env.JWT_SECRET || 'smart_asset_secret_key_2026',
  { expiresIn: '7d' }
);

const recordAuthEvent = async ({ userId = null, action, result, req }) => {
  try {
    await AuditLog.create({
      userId,
      action,
      entity: userId ? `user:${userId}` : 'auth',
      details: JSON.stringify({
        result,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      }),
    });
  } catch (error) {
    console.error('Authentication audit event failed:', error.message);
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const identity = username.trim();
    const candidateNames = resolveLoginAliases(identity);
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username: candidateNames },
          { email: candidateNames }
        ]
      }
    });

    if (!user) {
      await recordAuthEvent({ action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.active) {
      await recordAuthEvent({ userId: user.id, action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(403).json({ success: false, message: 'This account is disabled.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordAuthEvent({ userId: user.id, action: 'LOGIN_FAILED', result: 'Failure', req });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      phone: user.phone,
    };

    await recordAuthEvent({ userId: user.id, action: 'LOGIN', result: 'Success', req });

    return res.json({
      success: true,
      token: generateToken(user),
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password, fullName, role = 'student', department = '' } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ where: { [require('sequelize').Op.or]: [{ username }, { email }] } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName: fullName || username,
      role,
      department,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
      },
      token: generateToken(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    if (String(newPassword).length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const user = await User.findByPk(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    await user.update({ password: await bcrypt.hash(newPassword, 10) });
    await AuditLog.create({ userId: user.id, action: 'PASSWORD_CHANGED', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const logout = async (req, res) => {
  await recordAuthEvent({ userId: req.user.id, action: 'LOGOUT', result: 'Success', req });
  res.json({ success: true });
};

module.exports = {
  login,
  register,
  generateToken,
  normalizeLoginIdentity,
  resolveLoginAliases,
  changePassword,
  logout,
};
