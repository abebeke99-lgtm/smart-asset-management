require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');

function resolveDemoPassword() {
  const configured = String(process.env.SEED_DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || '').trim();
  if (configured) return configured;

  throw new Error(
    'Seeding demo accounts requires SEED_DEMO_PASSWORD (or DEMO_USER_PASSWORD). Set it in the backend environment before enabling demo seeding.'
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
    username: 'college_manager',
    email: 'college@bekelei.com',
    fullName: 'College Manager',
    role: 'college_manager',
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

function resolveDemoUsers() {
  const password = resolveDemoPassword();
  return DEMO_USERS.map((userData) => ({ ...userData, password }));
}

const normalizeCollegeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (['college', 'college manager', 'college-manager', 'college_manager'].includes(value)) return 'college_manager';
  return value;
};

async function ensureCollegeScopeForUser(userRecord, collegeModel = College) {
  if (!userRecord || normalizeCollegeRole(userRecord.role) !== 'college_manager') return;

  const departmentName = String(userRecord.department || 'Engineering').trim() || 'Engineering';
  let college = await collegeModel.findOne({ where: { managerId: userRecord.id, status: 'active' } });
  if (!college) {
    college = await collegeModel.findOne({ where: { collegeName: departmentName, status: 'active' } });
  }
  if (!college) {
    const collegeCode = `CLG-${String(departmentName).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ENG'}`;
    college = await collegeModel.create({
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

async function ensureDepartmentScopeForUser(userRecord, { collegeModel = College, departmentModel = Department } = {}) {
  if (!userRecord || userRecord.role !== 'department_head') return;

  const departmentName = String(userRecord.department || 'Engineering').trim() || 'Engineering';
  let department = await departmentModel.findOne({ where: { name: departmentName, status: 'active' } });

  if (!department) {
    let college = await collegeModel.findOne({ where: { managerId: userRecord.id, status: 'active' } });
    if (!college) {
      college = await collegeModel.findOne({ where: { collegeName: departmentName, status: 'active' } });
    }
    if (!college) {
      const collegeCode = `CLG-${String(departmentName).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ENG'}`;
      college = await collegeModel.create({
        collegeCode,
        collegeName: departmentName,
        managerId: userRecord.id,
        description: `Auto-created college scope for ${userRecord.fullName || userRecord.username}`,
        status: 'active',
      });
    }

    const departmentCode = String(departmentName).slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
    try {
      department = await departmentModel.create({
        name: departmentName,
        code: departmentCode,
        description: `Auto-created department scope for ${userRecord.fullName || userRecord.username}`,
        headId: userRecord.id,
        collegeId: college.id,
        status: 'active',
      });
    } catch (error) {
      department = await departmentModel.findOne({ where: { name: departmentName } });
      if (!department) {
        throw error;
      }
    }
  }

  if (department && (Number(userRecord.departmentId) !== Number(department.id) || Number(userRecord.collegeId) !== Number(department.collegeId || userRecord.collegeId))) {
    await userRecord.update({ departmentId: department.id, collegeId: department.collegeId || userRecord.collegeId || null });
  }
}

async function ensureDemoUser(userData, { userModel = User, collegeModel = College, departmentModel = Department } = {}) {
  const existingUser = await userModel.findOne({ where: { username: userData.username } });
  if (existingUser) {
    return false;
  }

  const emailOwner = userData.email
    ? await userModel.findOne({ where: { email: userData.email } })
    : null;
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const [createdUser, created] = await userModel.findOrCreate({
    where: { username: userData.username },
    defaults: {
      ...userData,
      email: emailOwner ? null : userData.email,
      password: hashedPassword,
    },
  });
  if (!created) return false;

  if (normalizeCollegeRole(userData.role) === 'college_manager') {
    await ensureCollegeScopeForUser(createdUser, collegeModel);
  }
  if (userData.role === 'department_head') {
    await ensureDepartmentScopeForUser(createdUser, { collegeModel, departmentModel });
  }
  if (userData.role === 'store_manager') {
    const activeCollege = await collegeModel.findOne({ where: { status: 'active' }, order: [['id', 'ASC']] });
    if (activeCollege && Number(createdUser.collegeId) !== Number(activeCollege.id)) {
      await createdUser.update({ collegeId: activeCollege.id });
    }
  }
  return true;
}

async function seedDatabase(options = {}) {
  const password = options.password === undefined ? resolveDemoPassword() : options.password;
  const models = {
    userModel: options.userModel || User,
    collegeModel: options.collegeModel || College,
    departmentModel: options.departmentModel || Department,
  };
  const counts = { created: 0, existing: 0 };

  for (const userData of DEMO_USERS) {
    const created = await ensureDemoUser({ ...userData, password }, models);
    counts[created ? 'created' : 'existing'] += 1;
  }

  return counts;
}

module.exports = { seedDatabase, DEMO_USERS, resolveDemoPassword };