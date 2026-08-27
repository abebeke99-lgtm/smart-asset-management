const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEMO_USERS = [
  {
    username: 'admin',
    email: 'admin@bekelei.com',
    password: 'bekelei123',
    fullName: 'System Administrator',
    role: 'admin',
    department: 'Administration',
    phone: '0986481821',
    active: true,
  },
  {
    username: 'ict_officer',
    email: 'ict@bekelei.com',
    password: 'bekelei123',
    fullName: 'ICT Officer',
    role: 'ict_officer',
    department: 'ICT',
    phone: '0912345678',
    active: true,
  },
  {
    username: 'department_head',
    email: 'department@bekelei.com',
    password: 'bekelei123',
    fullName: 'Department Head',
    role: 'department_head',
    department: 'Engineering',
    phone: '0922345678',
    active: true,
  },
  {
    username: 'finance',
    email: 'finance@bekelei.com',
    password: 'bekelei123',
    fullName: 'Finance Manager',
    role: 'finance',
    department: 'Finance',
    phone: '0932345678',
    active: true,
  },
  {
    username: 'store_manager',
    email: 'store@bekelei.com',
    password: 'bekelei123',
    fullName: 'Store Manager',
    role: 'store_manager',
    department: 'Store',
    phone: '0942345678',
    active: true,
  },
  {
    username: 'maintenance',
    email: 'maintenance@bekelei.com',
    password: 'bekelei123',
    fullName: 'Maintenance Coordinator',
    role: 'maintenance',
    department: 'Maintenance',
    phone: '0952345678',
    active: true,
  },
];

const LEGACY_USERNAME_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict officer', 'ict-officer', 'ict'],
  department_head: ['department_head', 'department head', 'dept_head', 'dept-head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store manager', 'store-manager', 'store'],
  maintenance: ['maintenance'],
};

async function ensureDemoUser(userData) {
  const aliasNames = LEGACY_USERNAME_ALIASES[userData.role] || [userData.username];
  const candidates = [...new Set(aliasNames.map((value) => String(value).trim()).filter(Boolean))];

  let existingUser = null;
  for (const username of candidates) {
    existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      break;
    }
  }

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await User.create({
      ...userData,
      username: userData.username,
      password: hashedPassword,
    });
    console.log(`✅ Created missing user: ${userData.username} (${userData.role})`);
    return;
  }

  const preferredUsername = userData.username;
  const aliasUpdates = candidates.filter((candidate) => candidate !== preferredUsername);
  const needsRoleUpdate = existingUser.role !== userData.role || existingUser.email !== userData.email || existingUser.active !== userData.active;
  const needsRename = existingUser.username !== preferredUsername;

  await existingUser.update({
    username: preferredUsername,
    email: userData.email,
    role: userData.role,
    fullName: userData.fullName,
    department: userData.department,
    phone: userData.phone,
    active: userData.active,
  });

  for (const legacyUsername of aliasUpdates) {
    const existingAlias = await User.findOne({ where: { username: legacyUsername } });
    if (existingAlias && existingAlias.id !== existingUser.id) {
      await existingAlias.destroy();
    }
  }

  const storedPassword = String(existingUser.password || '');
  const passwordLooksHashed = storedPassword.startsWith('$2');
  if (!passwordLooksHashed) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await existingUser.update({ password: hashedPassword });
  }

  if (needsRoleUpdate || needsRename) {
    console.log(`✅ Normalized demo user: ${existingUser.username} (${userData.role})`);
  }
}

async function seedDatabase() {
  try {
    const totalUsers = await User.count();

    if (totalUsers === 0) {
      for (const userData of DEMO_USERS) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await User.create({
          ...userData,
          password: hashedPassword,
        });
      }
      console.log('✅ Seeded all demo accounts with roles: admin, ict_officer, department_head, finance, store_manager, maintenance');
      console.log('📝 All users use password: bekelei123');
      return;
    }

    for (const userData of DEMO_USERS) {
      await ensureDemoUser(userData);
    }

    console.log('✅ All demo accounts verified and ready');
  } catch (error) {
    console.error('❌ Seed database failed:', error.message);
  }
}

module.exports = { seedDatabase, DEMO_USERS };
