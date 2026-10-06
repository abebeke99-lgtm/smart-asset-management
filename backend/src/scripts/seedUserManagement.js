require('dotenv').config();
require('../models');

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User, Role, College, Department } = require('../models');
const { ROLE_NAMES } = require('../constants/rolePermissions');

const labels = {
  admin: 'Administrator',
  ict_officer: 'ICT Officer',
  college: 'College',
  college_manager: 'College Manager',
  department_head: 'Department Head',
  finance: 'Finance',
  store_manager: 'Store Manager',
  maintenance: 'Maintenance',
  infrastructure: 'Infrastructure',
  teaching_assistant: 'Teaching Assistant',
  staff: 'Staff',
  student: 'Student',
};

async function seedUserManagement() {
  const password = String(process.env.USER_MANAGEMENT_SEED_PASSWORD || '');
  if (password.length < 8) {
    throw new Error('Set USER_MANAGEMENT_SEED_PASSWORD to a value of at least 8 characters before seeding accounts.');
  }

  for (const name of ROLE_NAMES) {
    await Role.findOrCreate({ where: { name }, defaults: { displayName: labels[name] || name } });
  }

  const collegeData = [
    { collegeCode: 'SAMPLE-ENG', collegeName: 'College of Engineering' },
    { collegeCode: 'SAMPLE-BUS', collegeName: 'College of Business' },
    { collegeCode: 'SAMPLE-SCI', collegeName: 'College of Natural Sciences' },
  ];
  for (const data of collegeData) {
    await College.findOrCreate({ where: { collegeCode: data.collegeCode }, defaults: { ...data, status: 'active' } });
  }

  const departments = [
    ['Computer Science', 'CS', 'SAMPLE-ENG'],
    ['Electrical Engineering', 'EE', 'SAMPLE-ENG'],
    ['Management', 'MGT', 'SAMPLE-BUS'],
    ['Accounting', 'ACC', 'SAMPLE-BUS'],
    ['Biology', 'BIO', 'SAMPLE-SCI'],
    ['Chemistry', 'CHEM', 'SAMPLE-SCI'],
  ];
  for (const [name, code, collegeCode] of departments) {
    const college = await College.findOne({ where: { collegeCode } });
    await Department.findOrCreate({
      where: { name },
      defaults: { name, code, collegeId: college.id, status: 'active' },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const users = [
    { username: 'admin', email: 'admin@example.invalid', fullName: 'System Administrator', role: 'admin' },
    { username: 'ict_officer', email: 'ict.officer@example.invalid', fullName: 'ICT Officer', role: 'ict_officer' },
  ];
  for (const userData of users) {
    await User.findOrCreate({
      where: { username: userData.username },
      defaults: { ...userData, password: passwordHash, active: true, status: 'active' },
    });
  }
}

seedUserManagement()
  .then(() => console.log('User management roles, colleges, departments, and demo accounts are ready.'))
  .catch((error) => {
    console.error('User management seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
