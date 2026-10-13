const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  Campus,
  College,
  CollegeRegistrationApplication,
  User,
  AuditLog,
} = require('../models');
const { isValidEmail, isValidUsername } = require('../utils/validators');
const { getSecuritySettings, validatePassword } = require('../services/passwordPolicyService');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeCode = (value) => String(value || '').trim().toUpperCase();
const normalizeUsername = (value) => String(value || '').trim();
const statusTokenHash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safeApplication = (application) => ({
  id: application.id,
  collegeName: application.collegeName,
  collegeCode: application.collegeCode,
  campusId: application.campusId,
  campusName: application.CampusRecord?.campusName || null,
  collegeDescription: application.collegeDescription,
  collegeEmail: application.collegeEmail,
  collegePhone: application.collegePhone,
  officeLocation: application.officeLocation,
  representativeFullName: application.representativeFullName,
  representativeUsername: application.representativeUsername,
  representativeEmail: application.representativeEmail,
  representativePhone: application.representativePhone,
  status: application.status,
  submittedAt: application.submittedAt,
  reviewedAt: application.reviewedAt,
  reviewedBy: application.reviewedBy,
  rejectionReason: application.rejectionReason,
  collegeId: application.collegeId,
  userId: application.userId,
});

const validateApplication = (body) => {
  const values = {
    collegeName: String(body.collegeName || '').trim(),
    collegeCode: normalizeCode(body.collegeCode),
    campusId: body.campusId === '' || body.campusId === undefined || body.campusId === null ? null : Number(body.campusId),
    collegeDescription: String(body.collegeDescription || '').trim(),
    collegeEmail: normalizeEmail(body.collegeEmail),
    collegePhone: String(body.collegePhone || '').trim(),
    officeLocation: String(body.officeLocation || '').trim(),
    representativeFullName: String(body.representativeFullName || '').trim(),
    representativeUsername: normalizeUsername(body.representativeUsername),
    representativeEmail: normalizeEmail(body.representativeEmail),
    representativePhone: String(body.representativePhone || '').trim(),
  };
  const errors = {};

  if (values.collegeName.length < 2 || values.collegeName.length > 255) errors.collegeName = 'College name must be between 2 and 255 characters.';
  if (!/^[A-Z0-9][A-Z0-9._-]{1,99}$/.test(values.collegeCode)) errors.collegeCode = 'Enter a valid college code (2–100 letters, numbers, dots, underscores, or hyphens).';
  if (values.campusId !== null && (!Number.isInteger(values.campusId) || values.campusId < 1)) errors.campusId = 'Choose a valid campus.';
  if (values.collegeDescription.length > 5000) errors.collegeDescription = 'College description must be 5,000 characters or fewer.';
  if (values.collegeEmail.length > 255 || !isValidEmail(values.collegeEmail)) errors.collegeEmail = 'Enter a valid official college email address.';
  if (values.collegePhone.length > 50 || !/^\+?[\d\s().-]{7,50}$/.test(values.collegePhone)) errors.collegePhone = 'Enter a valid college phone number.';
  if (!values.officeLocation || values.officeLocation.length > 255) errors.officeLocation = 'Office location is required and must be 255 characters or fewer.';
  if (!values.representativeFullName || values.representativeFullName.length > 255) errors.representativeFullName = 'Representative name is required and must be 255 characters or fewer.';
  if (!isValidUsername(values.representativeUsername) || values.representativeUsername.length > 100) errors.representativeUsername = 'Username must be between 3 and 100 characters.';
  if (values.representativeEmail.length > 255 || !isValidEmail(values.representativeEmail)) errors.representativeEmail = 'Enter a valid representative email address.';
  if (values.representativePhone.length > 50 || !/^\+?[\d\s().-]{7,50}$/.test(values.representativePhone)) errors.representativePhone = 'Enter a valid representative phone number.';
  if (typeof body.password !== 'string' || !body.password) errors.password = 'Password is required.';
  if (typeof body.confirmPassword !== 'string' || !body.confirmPassword) errors.confirmPassword = 'Confirm password is required.';
  else if (body.password !== body.confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  return { values, errors };
};

const conflictResponse = (res, message) => res.status(409).json({ success: false, message });

const listCampuses = async (req, res, next) => {
  try {
    const campuses = await Campus.findAll({
      where: { status: 'active' },
      attributes: ['id', 'campusName'],
      order: [['campusName', 'ASC']],
    });
    return res.json({ success: true, campuses });
  } catch (error) {
    return next(error);
  }
};

const submitApplication = async (req, res, next) => {
  try {
    const { values, errors } = validateApplication(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: 'Review the highlighted fields.', errors });
    const passwordError = validatePassword(req.body.password, await getSecuritySettings());
    if (passwordError) return res.status(400).json({ success: false, message: passwordError, errors: { password: passwordError } });

    const [passwordHash, statusToken] = await Promise.all([
      bcrypt.hash(req.body.password, 10),
      Promise.resolve(crypto.randomBytes(32).toString('hex')),
    ]);
    const normalizedUsername = values.representativeUsername.toLowerCase();
    const normalizedEmail = values.representativeEmail.toLowerCase();

    const application = await sequelize.transaction(async (transaction) => {
      if (values.campusId !== null) {
        const campus = await Campus.findOne({ where: { id: values.campusId, status: 'active' }, transaction });
        if (!campus) {
          const error = new Error('The selected campus is unavailable.');
          error.status = 400;
          throw error;
        }
      }

      const [existingCollege, existingUser, existingApplication] = await Promise.all([
        College.findOne({ where: { collegeCode: values.collegeCode }, transaction }),
        User.findOne({ where: { [Op.or]: [{ username: values.representativeUsername }, { email: values.representativeEmail }] }, transaction }),
        CollegeRegistrationApplication.findOne({
          where: {
            status: 'pending',
            [Op.or]: [
              { reservedCollegeCode: values.collegeCode },
              { reservedUsername: normalizedUsername },
              { reservedEmail: normalizedEmail },
            ],
          },
          transaction,
        }),
      ]);
      if (existingCollege) {
        const error = new Error('A college with this code is already registered.');
        error.status = 409;
        throw error;
      }
      if (existingUser) {
        const error = new Error('The representative username or email is already in use.');
        error.status = 409;
        throw error;
      }
      if (existingApplication) {
        const error = new Error('A pending application already uses this college code or representative account.');
        error.status = 409;
        throw error;
      }

      return CollegeRegistrationApplication.create({
        ...values,
        reservedCollegeCode: values.collegeCode,
        reservedUsername: normalizedUsername,
        reservedEmail: normalizedEmail,
        representativePasswordHash: passwordHash,
        statusTokenHash: statusTokenHash(statusToken),
        status: 'pending',
        submittedAt: new Date(),
      }, { transaction });
    });

    return res.status(201).json({
      success: true,
      message: 'College registration submitted for administrative review.',
      application: { id: application.id, collegeName: application.collegeName, status: application.status, submittedAt: application.submittedAt },
      statusToken,
    });
  } catch (error) {
    if (error.status === 409 || error.name === 'SequelizeUniqueConstraintError') {
      return conflictResponse(res, error.status === 409 ? error.message : 'A college code or representative account is already registered or pending.');
    }
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    return next(error);
  }
};

const getApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);
    const presentedToken = req.get('x-application-status-token');
    if (!Number.isInteger(applicationId) || applicationId < 1 || typeof presentedToken !== 'string' || presentedToken.length !== 64) {
      return res.status(404).json({ success: false, message: 'Registration application not found.' });
    }
    const application = await CollegeRegistrationApplication.findByPk(applicationId);
    if (!application) return res.status(404).json({ success: false, message: 'Registration application not found.' });
    const expected = Buffer.from(application.statusTokenHash, 'hex');
    const actual = Buffer.from(statusTokenHash(presentedToken), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return res.status(404).json({ success: false, message: 'Registration application not found.' });
    }
    return res.json({ success: true, application: {
      id: application.id,
      collegeName: application.collegeName,
      status: application.status,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      rejectionReason: application.rejectionReason,
    } });
  } catch (error) {
    return next(error);
  }
};

const listApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const result = await CollegeRegistrationApplication.findAndCountAll({
      where: { status },
      include: [{ model: Campus, as: 'CampusRecord', attributes: ['campusName'], required: false }],
      attributes: [
        'id', 'collegeName', 'collegeCode', 'campusId', 'collegeDescription', 'collegeEmail',
        'collegePhone', 'officeLocation', 'representativeFullName', 'representativeUsername',
        'representativeEmail', 'representativePhone', 'status', 'submittedAt', 'reviewedAt',
        'reviewedBy', 'rejectionReason', 'collegeId', 'userId',
      ],
      order: [['submittedAt', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      success: true,
      applications: result.rows.map(safeApplication),
      pagination: { page, limit, total: result.count, pages: Math.max(1, Math.ceil(result.count / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const approveApplication = async (req, res, next) => {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const application = await CollegeRegistrationApplication.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!application) return { notFound: true };
      if (application.status === 'approved') {
        if (!application.collegeId || !application.userId) throw new Error('Approved registration is missing its linked college or representative account.');
        return { alreadyApproved: true, application };
      }
      if (application.status !== 'pending') return { rejected: true };
      if (application.campusId !== null && application.campusId !== undefined) {
        const campus = await Campus.findOne({ where: { id: application.campusId, status: 'active' }, transaction });
        if (!campus) return { campusUnavailable: true };
      }

      const [existingCollege, existingUser] = await Promise.all([
        College.findOne({ where: { collegeCode: application.collegeCode }, transaction }),
        User.findOne({ where: { [Op.or]: [{ username: application.representativeUsername }, { email: application.representativeEmail }] }, transaction }),
      ]);
      if (existingCollege || existingUser) return { duplicate: true };

      const college = await College.create({
        collegeCode: application.collegeCode,
        collegeName: application.collegeName,
        campusId: application.campusId,
        description: application.collegeDescription,
        location: application.officeLocation,
        address: application.officeLocation,
        phone: application.collegePhone,
        email: application.collegeEmail,
        status: 'active',
      }, { transaction });
      const manager = await User.create({
        username: application.representativeUsername,
        email: application.representativeEmail,
        password: application.representativePasswordHash,
        fullName: application.representativeFullName,
        phone: application.representativePhone,
        role: 'college_manager',
        collegeId: college.id,
        active: true,
        status: 'active',
      }, { transaction });
      await college.update({ managerId: manager.id }, { transaction });
      await application.update({
        status: 'approved',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
        collegeId: college.id,
        userId: manager.id,
        representativePasswordHash: null,
        reservedCollegeCode: null,
        reservedUsername: null,
        reservedEmail: null,
      }, { transaction });
      await AuditLog.create({
        userId: req.user.id,
        action: 'COLLEGE_REGISTRATION_APPROVED',
        entity: `college:${college.id}`,
        details: JSON.stringify({ applicationId: application.id, collegeId: college.id, representativeUserId: manager.id }),
      }, { transaction });
      return { application, collegeId: college.id, userId: manager.id };
    });

    if (result.notFound) return res.status(404).json({ success: false, message: 'Registration application not found.' });
    if (result.rejected) return res.status(409).json({ success: false, message: 'Rejected applications cannot be approved.' });
    if (result.campusUnavailable) return res.status(409).json({ success: false, message: 'The selected campus is no longer active.' });
    if (result.duplicate) return res.status(409).json({ success: false, message: 'The college code or representative account is already in use.' });
    return res.status(200).json({
      success: true,
      message: result.alreadyApproved ? 'Registration was already approved.' : 'College registration approved.',
      application: { id: result.application.id, status: 'approved', collegeId: result.collegeId || result.application.collegeId, userId: result.userId || result.application.userId },
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return conflictResponse(res, 'The college code or representative account is already in use.');
    return next(error);
  }
};

const rejectApplication = async (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) return res.status(400).json({ success: false, message: 'A rejection reason of 1–1,000 characters is required.' });
    const outcome = await sequelize.transaction(async (transaction) => {
      const application = await CollegeRegistrationApplication.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!application) return 'notFound';
      if (application.status !== 'pending') return application.status;
      await application.update({
        status: 'rejected',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
        representativePasswordHash: null,
        reservedCollegeCode: null,
        reservedUsername: null,
        reservedEmail: null,
      }, { transaction });
      await AuditLog.create({
        userId: req.user.id,
        action: 'COLLEGE_REGISTRATION_REJECTED',
        entity: `college-registration:${application.id}`,
        details: JSON.stringify({ applicationId: application.id, reason }),
      }, { transaction });
      return 'rejected';
    });
    if (outcome === 'notFound') return res.status(404).json({ success: false, message: 'Registration application not found.' });
    if (outcome !== 'rejected') return res.status(409).json({ success: false, message: `Application has already been ${outcome}.` });
    return res.json({ success: true, message: 'College registration rejected.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listCampuses,
  submitApplication,
  getApplicationStatus,
  listApplications,
  approveApplication,
  rejectApplication,
};
