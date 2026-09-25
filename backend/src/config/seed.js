require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');

function resolveDemoPassword() {
  const configured = String(process.env.SEED_DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || '').trim();
  if (configured) return configured;
  throw new Error(
    'Seeding demo accounts requires SEED_DEMO_PASSWORD (or DEMO_USER_PASSWORD) to be configured. Set it in the backend environment file.'
  );
}

const DEMO_USERS = [
  {
    username: 'admin',
    email: 'admin@bekelei.com',
    fullName: 'System Administrator',
    role: 'admin',
    department: 'Administration',
    phone: '0986481821',
    active: true,
  },
  {
    username: 'ict_officer',
    email: 'ict@bekelei.com',
    fullName: 'ICT Officer',
    role: 'ict_officer',
    department: 'ICT',
    phone: '0912345678',
    active: true,
  },
  {
    username: 'college',
    email: 'college@bekelei.com',
    fullName: 'College Manager',
    role: 'college',
    department: 'Engineering',
    phone: '0922345678',
    active: true,
  },
  {
    username: 'department_head',
    email: 'department@bekelei.com',
    fullName: 'Department Manager',
    role: 'department_head',
    department: 'Engineering',
    phone: '0972345678',
    active: true,
  },
  {
    username: 'finance',
    email: 'finance@bekelei.com',
    fullName: 'Finance Manager',
    role: 'finance',
    department: 'Finance',
    phone: '0932345678',
    active: true,
  },
  {
    username: 'store_manager',
    email: 'store@bekelei.com',
    fullName: 'Store Manager',
    role: 'store_manager',
    department: 'Store',
    phone: '0942345678',
    active: true,
  },
  {
    username: 'maintenance',
    email: 'maintenance@bekelei.com',
    fullName: 'Maintenance Coordinator',
    role: 'maintenance',
    department: 'Maintenance',
    phone: '0952345678',
    active: true,
  },
  {
    username: 'infrastructure',
    email: 'infrastructure@bekelei.com',
    fullName: 'Infrastructure Directorate',
    role: 'infrastructure',
    department: 'Infrastructure',
    phone: '0962345678',
    active: true,
  },
];

const LEGACY_USERNAME_ALIASES = {
  admin: ['admin'],
  ict_officer: ['ict_officer', 'ict officer', 'ict-officer', 'ict'],
  college: ['college'],
  department_head: ['department_head', 'dept_head', 'department head', 'department'],
  finance: ['finance'],
  store_manager: ['store_manager', 'store manager', 'store-manager', 'store'],
  maintenance: ['maintenance'],
  infrastructure: ['infrastructure', 'infrastructure_directorate', 'infra', 'infrastructure directorate'],
};

function resolveDemoUsers() {
  const password = resolveDemoPassword();
  return DEMO_USERS.map((userData) => ({ ...userData, password }));
}

async function ensureCollegeScopeForUser(userRecord) {
  if (!userRecord || userRecord.role !== 'college') return;

  const departmentName = String(userRecord.department || 'Engineering').trim() || 'Engineering';
  let college = await College.findOne({ where: { managerId: userRecord.id, status: 'active' } });
  if (!college) {
    college = await College.findOne({ where: { collegeName: departmentName, status: 'active' } });
  }
  if (!college) {
    const collegeCode = `CLG-${String(departmentName).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ENG'}`;
    college = await College.create({
      collegeCode,
      collegeName: departmentName,
      managerId: userRecord.id,
      description: `Auto-created college scope for ${userRecord.fullName || userRecord.username}`,
      status: 'active',
    });
  }

  if (Number(userRecord.collegeId) !== Number(college.id)) {
    await userRecord.update({ collegeId: college.id });
  }
}

async function ensureDepartmentScopeForUser(userRecord) {
  if (!userRecord || userRecord.role !== 'department_head') return;

  const departmentName = String(userRecord.department || 'Engineering').trim() || 'Engineering';
  let department = await Department.findOne({ where: { name: departmentName, status: 'active' } });

  if (!department) {
    let college = await College.findOne({ where: { managerId: userRecord.id, status: 'active' } });
    if (!college) {
      college = await College.findOne({ where: { collegeName: departmentName, status: 'active' } });
    }
    if (!college) {
      const collegeCode = `CLG-${String(departmentName).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ENG'}`;
      college = await College.create({
        collegeCode,
        collegeName: departmentName,
        managerId: userRecord.id,
        description: `Auto-created college scope for ${userRecord.fullName || userRecord.username}`,
        status: 'active',
      });
    }

    const departmentCode = String(departmentName).slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
    try {
      department = await Department.create({
        name: departmentName,
        code: departmentCode,
        description: `Auto-created department scope for ${userRecord.fullName || userRecord.username}`,
        headId: userRecord.id,
        collegeId: college.id,
        status: 'active',
      });
    } catch (error) {
      department = await Department.findOne({ where: { name: departmentName } });
      if (!department) {
        throw error;
      }
    }
  }

  if (department && (Number(userRecord.departmentId) !== Number(department.id) || Number(userRecord.collegeId) !== Number(department.collegeId || userRecord.collegeId))) {
    await userRecord.update({ departmentId: department.id, collegeId: department.collegeId || userRecord.collegeId || null });
  }
}

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
    const createdUser = await User.create({
      ...userData,
      username: userData.username,
      password: hashedPassword,
    });
    if (userData.role === 'college') {
      await ensureCollegeScopeForUser(createdUser);
    }
    if (userData.role === 'department_head') {
      await ensureDepartmentScopeForUser(createdUser);
    }
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

  if (userData.role === 'college') {
    await ensureCollegeScopeForUser(existingUser);
  }
  if (userData.role === 'department_head') {
    await ensureDepartmentScopeForUser(existingUser);
  }

  for (const legacyUsername of aliasUpdates) {
    const existingAlias = await User.findOne({ where: { username: legacyUsername } });
    if (existingAlias && existingAlias.id !== existingUser.id) {
      await existingAlias.destroy();
    }
  }

  const storedPassword = String(existingUser.password || '');
  const passwordMatches = storedPassword.startsWith('$2')
    ? await bcrypt.compare(userData.password, storedPassword)
    : storedPassword === userData.password;
  if (!passwordMatches) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await existingUser.update({ password: hashedPassword });
  }

  if (needsRoleUpdate || needsRename) {
    console.log(`✅ Normalized demo user: ${existingUser.username} (${userData.role})`);
  }
}

async function seedDatabase() {
  try {
    const demoUsers = resolveDemoUsers();
    const totalUsers = await User.count();

    if (totalUsers === 0) {
      for (const userData of demoUsers) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const createdUser = await User.create({
          ...userData,
          password: hashedPassword,
        });
        if (userData.role === 'college') await ensureCollegeScopeForUser(createdUser);
        if (userData.role === 'department_head') await ensureDepartmentScopeForUser(createdUser);
      }
      console.log('✅ Seeded all demo accounts with role-scoped access');
      return;
    }

    for (const userData of demoUsers) {
      await ensureDemoUser(userData);
    }

    console.log('✅ All demo accounts verified and ready');
  } catch (error) {
    console.error('❌ Seed database failed:', error.message);
  }
}

module.exports = { seedDatabase, DEMO_USERS };