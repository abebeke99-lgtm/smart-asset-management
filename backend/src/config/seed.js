require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Assignment = require('../models/Assignment');
const Maintenance = require('../models/Maintenance');
const Notification = require('../models/Notification');
const College = require('../models/College');
const Department = require('../models/Department');
const Location = require('../models/Location');

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
    email: 'ict_officer@bekelei.com',
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

function normalizeDemoUserSeed(userData = {}) {
  return {
    username: String(userData.username || '').trim(),
    email: String(userData.email || '').trim().toLowerCase(),
    fullName: String(userData.fullName || userData.username || '').trim(),
    role: String(userData.role || 'student').trim(),
    department: String(userData.department || '').trim(),
    phone: String(userData.phone || '').trim(),
    active: userData.active !== false,
    password: String(userData.password || '').trim(),
  };
}

const normalizeEmailLocalPart = (email = '') => String(email || '').trim().toLowerCase().split('@')[0] || '';

const hasEmailClaimConflict = (candidateEmail, existingEmail) => {
  const candidateLocal = normalizeEmailLocalPart(candidateEmail);
  const existingLocal = normalizeEmailLocalPart(existingEmail);
  if (!candidateLocal || !existingLocal) return false;
  if (candidateLocal === existingLocal) return true;
  return candidateLocal.startsWith(existingLocal) || existingLocal.startsWith(candidateLocal);
};

const applyUserUpdates = async (existingUser, updates, userModel) => {
  if (!Object.keys(updates).length) {
    return existingUser;
  }

  if (typeof existingUser.update === 'function') {
    await existingUser.update(updates);
    return existingUser;
  }

  Object.assign(existingUser, updates);
  if (typeof userModel?.update === 'function') {
    await userModel.update(updates, { where: { username: existingUser.username } });
  }
  return existingUser;
};

async function ensureDemoUser(userData, { userModel = User, collegeModel = College, departmentModel = Department } = {}) {
  const normalizedUserData = normalizeDemoUserSeed(userData);
  const existingUser = await userModel.findOne({ where: { username: normalizedUserData.username } });

  if (normalizedUserData.username === 'department_head') {
    const conflictingAlias = await userModel.findOne({ where: { username: 'department' } });
    if (conflictingAlias && (!existingUser || conflictingAlias.id !== existingUser.id)) {
      await conflictingAlias.destroy();
    }
  }

  if (existingUser) {
    const updates = {};
    const emailOwner = normalizedUserData.email
      ? await userModel.findOne({ where: { email: normalizedUserData.email } })
      : null;

    if (normalizedUserData.email && existingUser.email !== normalizedUserData.email && (!emailOwner || String(emailOwner.username) === normalizedUserData.username)) {
      updates.email = normalizedUserData.email;
    } else if (!normalizedUserData.email && existingUser.email) {
      updates.email = null;
    }

    if (normalizedUserData.email && existingUser.email && !updates.email && existingUser.email !== normalizedUserData.email) {
      const conflictingOwner = await userModel.findOne({ where: { email: normalizedUserData.email } });
      if (!conflictingOwner || String(conflictingOwner.username) === normalizedUserData.username) {
        updates.email = normalizedUserData.email;
      }
    }

    if (normalizedUserData.fullName && existingUser.fullName !== normalizedUserData.fullName) updates.fullName = normalizedUserData.fullName;
    if (normalizedUserData.role && existingUser.role !== normalizedUserData.role) updates.role = normalizedUserData.role;
    if (normalizedUserData.department && existingUser.department !== normalizedUserData.department) updates.department = normalizedUserData.department;
    if (normalizedUserData.phone && existingUser.phone !== normalizedUserData.phone) updates.phone = normalizedUserData.phone;
    if (existingUser.active !== normalizedUserData.active) {
      updates.active = normalizedUserData.active;
      updates.status = normalizedUserData.active ? 'active' : 'inactive';
    }

    const passwordNeedsRefresh = normalizedUserData.password && (
      !existingUser.password ||
      !String(existingUser.password).trim() ||
      !(await bcrypt.compare(normalizedUserData.password, existingUser.password))
    );
    if (passwordNeedsRefresh) {
      updates.password = await bcrypt.hash(normalizedUserData.password, 10);
      updates.failedLoginAttempts = 0;
      updates.lockoutUntil = null;
    }

    if (Object.keys(updates).length > 0) {
      await applyUserUpdates(existingUser, updates, userModel);
      return { created: false, updated: true, user: existingUser };
    }

    return { created: false, updated: false, user: existingUser };
  }

  const emailOwner = normalizedUserData.email
    ? await userModel.findOne({ where: { email: normalizedUserData.email } })
    : null;
  const hashedPassword = await bcrypt.hash(normalizedUserData.password, 10);
  const [createdUser, created] = await userModel.findOrCreate({
    where: { username: normalizedUserData.username },
    defaults: {
      ...normalizedUserData,
      email: emailOwner ? null : normalizedUserData.email,
      password: hashedPassword,
    },
  });
  if (created && normalizedUserData.email && !createdUser.email && emailOwner) {
    await createdUser.update({ email: null });
  }
  if (!created) return { created: false, updated: false, user: createdUser };

  if (normalizeCollegeRole(normalizedUserData.role) === 'college_manager') {
    await ensureCollegeScopeForUser(createdUser, collegeModel);
  }
  if (normalizedUserData.role === 'department_head') {
    await ensureDepartmentScopeForUser(createdUser, { collegeModel, departmentModel });
  }
  if (normalizedUserData.role === 'store_manager') {
    const activeCollege = await collegeModel.findOne({ where: { status: 'active' }, order: [['id', 'ASC']] });
    if (activeCollege && Number(createdUser.collegeId) !== Number(activeCollege.id)) {
      await createdUser.update({ collegeId: activeCollege.id });
    }
  }
  return { created: true, updated: false, user: createdUser };
}

function buildSampleAssetRow(index, collegeId, departmentId, locationId) {
  const pad = String(index + 1).padStart(4, '0');
  const categoryNames = ['Laptop', 'Desktop', 'Projector', 'Printer', 'Network Device', 'Furniture', 'Server', 'Monitor'];
  const assetNames = [
    'Dell Latitude 7440', 'HP EliteDesk 800', 'Epson Projector', 'Brother MFC-L3770', 'Cisco Catalyst Switch',
    'Office Chair', 'Dell PowerEdge Server', 'Dell 24-inch Monitor', 'Lenovo ThinkPad T14', 'Cisco Access Point',
    'LaserJet Printer', 'APC UPS', 'Acer Monitor', 'MacBook Pro 14', 'Network Router', 'Conference Table', 'Security Camera',
    'Storage NAS', 'Tablet Device', 'Video Conference Kit',
  ];
  const statusList = ['available', 'in-use', 'under-maintenance', 'reserved', 'available'];
  const date = new Date(Date.now() - ((index % 12) * 12 + 8) * 86400000);
  const asset = {
    name: assetNames[index % assetNames.length] + ` ${pad}`,
    category: categoryNames[index % categoryNames.length],
    subcategory: 'IT Equipment',
    unit: 'unit',
    description: `Sample ${categoryNames[index % categoryNames.length].toLowerCase()} asset for development testing.`,
    serialNumber: `SN-${pad}-${(index * 17) % 1000}`,
    assetCode: `ASSET-${pad}`,
    digitalId: `DIGI-${pad}`,
    rfidTag: `RFID-${pad}`,
    status: statusList[index % statusList.length],
    condition: ['Excellent', 'Good', 'Fair', 'Poor'][index % 4],
    department: ['Engineering', 'ICT', 'Administration', 'Library', 'Finance'][index % 5],
    collegeId,
    departmentId,
    location: `Location ${((index % 5) + 1)}`,
    quantity: 1,
    specifications: { model: 'Demo', manufacturer: 'Bekelei', purchasedOn: date.toISOString().slice(0, 10) },
    fundingSource: 'Development Budget',
    purchaseDate: date,
    purchasePrice: 1500 + (index * 245),
    supplier: 'Bekelei Supplies',
    manufacturer: 'Bekelei Tech',
    model: `Series-${(index % 6) + 1}`,
    warrantyExpiry: new Date(Date.now() + (index + 1) * 31536000000),
    notes: 'Seeded for local verification and UI testing.',
    currentValue: 1000 + (index * 225),
    healthScore: 90 + (index % 10),
    createdBy: 1,
    campusId: null,
    buildingId: null,
    roomId: null,
  };
  return asset;
}

const getCandidateUniqueValues = (valueSet = {}) => {
  const conditions = [];
  for (const [key, value] of Object.entries(valueSet)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !(value instanceof Date)) continue;
    conditions.push({ [key]: value });
  }
  return conditions;
};

const findMatchingRecord = async (model, where) => {
  if (!model || typeof model.findOne !== 'function') return null;
  if (where && typeof where === 'object' && where[Op.or]) {
    for (const condition of where[Op.or]) {
      const existing = await model.findOne({ where: condition });
      if (existing) return existing;
    }
    return null;
  }
  return model.findOne({ where });
};

const findDuplicateCandidate = async (model, where = {}, defaults = {}) => {
  const uniqueCandidates = getCandidateUniqueValues({ ...where, ...defaults });
  if (!uniqueCandidates.length) return null;
  return findMatchingRecord(model, { [Op.or]: uniqueCandidates });
};

const isDuplicateConstraintError = (error) => error?.name === 'SequelizeUniqueConstraintError' || error?.parent?.code === 'ER_DUP_ENTRY';

const findOrCreateRecord = async (model, where, defaults = {}) => {
  const existingRecord = await findMatchingRecord(model, where) || await findDuplicateCandidate(model, where, defaults);
  if (existingRecord) return [existingRecord, false];

  if (typeof model?.findOrCreate === 'function') {
    try {
      return await model.findOrCreate({ where, defaults });
    } catch (error) {
      if (!isDuplicateConstraintError(error)) throw error;
      const existing = await findMatchingRecord(model, where) || await findDuplicateCandidate(model, where, defaults);
      if (existing) return [existing, false];
      throw error;
    }
  }

  if (typeof model?.create === 'function') {
    try {
      const created = await model.create({ ...defaults, ...where });
      return [created, true];
    } catch (error) {
      if (!isDuplicateConstraintError(error)) throw error;
      const existing = await findMatchingRecord(model, where) || await findDuplicateCandidate(model, where, defaults);
      if (existing) return [existing, false];
      throw error;
    }
  }

  return [{ ...where, ...defaults }, true];
};

async function seedOperationalData(options = {}) {
  const models = {
    assetModel: options.assetModel || Asset,
    assignmentModel: options.assignmentModel || Assignment,
    maintenanceModel: options.maintenanceModel || Maintenance,
    notificationModel: options.notificationModel || Notification,
    userModel: options.userModel || User,
    collegeModel: options.collegeModel || College,
    departmentModel: options.departmentModel || Department,
    locationModel: options.locationModel || Location,
  };

  const userModel = models.userModel || User;
  const hasFindAll = typeof userModel?.findAll === 'function';
  const userRows = hasFindAll ? await userModel.findAll({ where: { active: true }, attributes: ['id','username','email','role'] }) : [];

  const normalizedColleges = await Promise.all([
    findOrCreateRecord(models.collegeModel, { collegeName: 'Engineering' }, { collegeCode: 'ENG-01', description: 'Engineering college', status: 'active' }),
    findOrCreateRecord(models.collegeModel, { collegeName: 'Business' }, { collegeCode: 'BUS-01', description: 'Business college', status: 'active' }),
  ]);
  const collegeIds = normalizedColleges.map(([college]) => college.id);

  const departmentNames = ['Engineering', 'ICT', 'Finance', 'Administration', 'Library'];
  const departments = [];
  for (let index = 0; index < departmentNames.length; index += 1) {
    const departmentName = departmentNames[index];
    const [department] = await findOrCreateRecord(models.departmentModel, { name: departmentName }, {
      code: departmentName.slice(0, 6).toUpperCase(),
      collegeId: collegeIds[index % collegeIds.length],
      description: `${departmentName} department sample data`,
      status: 'active',
    });
    departments.push(department);
  }

  const locations = [];
  for (let index = 0; index < 5; index += 1) {
    const [location] = await findOrCreateRecord(models.locationModel, { name: `Building ${index + 1}` }, { code: `BLD-${index + 1}`, description: `Sample location ${index + 1}`, status: 'active' });
    locations.push(location);
  }

  const seedUsers = userRows.length ? userRows : [
    { id: 1, username: 'admin', email: 'admin@bekelei.com', role: 'admin' },
    { id: 2, username: 'ict_officer', email: 'ict_officer@bekelei.com', role: 'ict_officer' },
  ];

  const assetRows = [];
  for (let index = 0; index < 20; index += 1) {
    const department = departments[index % departments.length];
    const location = locations[index % locations.length];
    const row = buildSampleAssetRow(index, department.collegeId || collegeIds[index % collegeIds.length], department.id, location.id);
    const [asset, created] = await findOrCreateRecord(models.assetModel, {
      [Op.or]: [
        { digitalId: row.digitalId },
        { assetCode: row.assetCode },
        { rfidTag: row.rfidTag },
        { serialNumber: row.serialNumber },
      ],
    }, row);
    if (!created && asset.digitalId !== row.digitalId) {
      await asset.update(row);
    }
    assetRows.push(asset);
  }

  const assignmentSeed = [
    { assetId: assetRows[0].id, assignedTo: seedUsers[1]?.id || 1, assignedToId: seedUsers[1]?.id || 1, assignedBy: seedUsers[0]?.id || 1, status: 'active', workflowStatus: 'assigned', location: 'Building 1', notes: 'Initial assignment' },
    { assetId: assetRows[1].id, assignedTo: seedUsers[2]?.id || 2, assignedToId: seedUsers[2]?.id || 2, assignedBy: seedUsers[0]?.id || 1, status: 'active', workflowStatus: 'assigned', location: 'Building 2', notes: 'Teaching equipment' },
    { assetId: assetRows[2].id, assignedTo: seedUsers[3]?.id || 3, assignedToId: seedUsers[3]?.id || 3, assignedBy: seedUsers[0]?.id || 1, status: 'returned', workflowStatus: 'returned', location: 'Building 3', notes: 'Returned after check' },
    { assetId: assetRows[3].id, assignedTo: seedUsers[1]?.id || 1, assignedToId: seedUsers[1]?.id || 1, assignedBy: seedUsers[0]?.id || 1, status: 'active', workflowStatus: 'assigned', location: 'Building 4', notes: 'Shared ICT resource' },
    { assetId: assetRows[4].id, assignedTo: seedUsers[0]?.id || 1, assignedToId: seedUsers[0]?.id || 1, assignedBy: seedUsers[0]?.id || 1, status: 'active', workflowStatus: 'assigned', location: 'Building 5', notes: 'Admin asset' },
  ];

  for (const assignment of assignmentSeed) {
    const [record] = await models.assignmentModel.findOrCreate({
      where: { assetId: assignment.assetId, assignedToId: assignment.assignedToId || assignment.assignedTo },
      defaults: {
        ...assignment,
        assignedToType: 'user',
        assignedDate: new Date(Date.now() - 86400000 * (assignment.workflowStatus === 'returned' ? 25 : 2)),
        expectedReturnDate: new Date(Date.now() + 86400000 * (assignment.workflowStatus === 'returned' ? 2 : 20)),
      },
    });
    if (record && record.status !== assignment.status) {
      await record.update({ ...assignment, assignedDate: new Date(Date.now() - 86400000), expectedReturnDate: new Date(Date.now() + 86400000 * 14) });
    }
  }

  const maintenanceSeeds = [
    { assetId: assetRows[5].id, requestedBy: seedUsers[0]?.id || 1, assignedTo: seedUsers[1]?.id || 1, title: 'Keyboard replacement', description: 'Replace worn keyboard', status: 'pending', priority: 'medium' },
    { assetId: assetRows[6].id, requestedBy: seedUsers[1]?.id || 1, assignedTo: seedUsers[1]?.id || 1, title: 'Server inspection', description: 'Check uptime and thermal output', status: 'in_progress', priority: 'high' },
    { assetId: assetRows[7].id, requestedBy: seedUsers[2]?.id || 2, assignedTo: seedUsers[1]?.id || 1, title: 'Monitor calibration', description: 'Calibrate display brightness', status: 'completed', priority: 'low' },
    { assetId: assetRows[8].id, requestedBy: seedUsers[3]?.id || 3, assignedTo: seedUsers[1]?.id || 1, title: 'Router reset', description: 'Faulty network link', status: 'scheduled', priority: 'high' },
    { assetId: assetRows[9].id, requestedBy: seedUsers[0]?.id || 1, assignedTo: seedUsers[1]?.id || 1, title: 'Battery replacement', description: 'Laptop battery issue', status: 'completed', priority: 'medium' },
  ];

  for (const maintenance of maintenanceSeeds) {
    await models.maintenanceModel.findOrCreate({
      where: { assetId: maintenance.assetId, title: maintenance.title },
      defaults: maintenance,
    });
  }

  const notificationSeeds = Array.from({ length: 10 }, (_, index) => ({
    userId: seedUsers[index % seedUsers.length]?.id || 1,
    recipientId: seedUsers[index % seedUsers.length]?.id || 1,
    title: `Notification ${index + 1}`,
    message: `Seeded notification ${index + 1} for local testing and dashboard review.`,
    type: ['system', 'alert', 'maintenance', 'assignment', 'info'][index % 5],
    category: 'general',
    priority: ['low', 'medium', 'high'][index % 3],
    channel: 'in_app',
    status: 'sent',
    read: index % 3 === 0,
    role: seedUsers[index % seedUsers.length]?.role || 'admin',
    actionUrl: '/assets',
  }));

  for (const notification of notificationSeeds) {
    await models.notificationModel.findOrCreate({
      where: { title: notification.title, message: notification.message },
      defaults: notification,
    });
  }

  return {
    assets: assetRows.length,
    assignments: assignmentSeed.length,
    maintenances: maintenanceSeeds.length,
    notifications: notificationSeeds.length,
  };
}

async function seedDatabase(options = {}) {
  const password = options.password === undefined ? resolveDemoPassword() : options.password;
  const models = {
    userModel: options.userModel || User,
    collegeModel: options.collegeModel || College,
    departmentModel: options.departmentModel || Department,
    assetModel: options.assetModel || Asset,
    assignmentModel: options.assignmentModel || Assignment,
    maintenanceModel: options.maintenanceModel || Maintenance,
    notificationModel: options.notificationModel || Notification,
    locationModel: options.locationModel || Location,
  };
  const counts = { created: 0, existing: 0 };

  for (const userData of DEMO_USERS) {
    const userPassword = userData.username === 'admin' && process.env.INITIAL_ADMIN_PASSWORD
      ? process.env.INITIAL_ADMIN_PASSWORD
      : password;
    const result = await ensureDemoUser({ ...userData, password: userPassword }, models);
    counts[result.created ? 'created' : 'existing'] += 1;
  }

  if (options.seedOperationalData !== false && (process.env.SEED_DEMO_DATA !== 'false' || process.env.NODE_ENV === 'development')) {
    try {
      const operationalData = await seedOperationalData(models);
      console.log(`[seed] Operational data seeded: ${operationalData.assets} assets, ${operationalData.assignments} assignments, ${operationalData.maintenances} maintenance records, ${operationalData.notifications} notifications.`);
    } catch (error) {
      if (isDuplicateConstraintError(error)) {
        console.warn('[seed] Operational data already exists; continuing with startup without crashing.');
      } else {
        throw error;
      }
    }
  }

  return counts;
}

module.exports = { seedDatabase, seedOperationalData, DEMO_USERS, resolveDemoPassword };