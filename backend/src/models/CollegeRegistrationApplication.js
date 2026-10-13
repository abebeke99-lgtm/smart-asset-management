const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CollegeRegistrationApplication = sequelize.define('CollegeRegistrationApplication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  collegeName: { type: DataTypes.STRING(255), allowNull: false, field: 'college_name' },
  collegeCode: { type: DataTypes.STRING(100), allowNull: false, field: 'college_code' },
  reservedCollegeCode: { type: DataTypes.STRING(100), allowNull: true, unique: true, field: 'reserved_college_code' },
  campusId: { type: DataTypes.INTEGER, allowNull: true, field: 'campus_id' },
  collegeDescription: { type: DataTypes.TEXT, allowNull: true, field: 'college_description' },
  collegeEmail: { type: DataTypes.STRING(255), allowNull: false, field: 'college_email' },
  collegePhone: { type: DataTypes.STRING(50), allowNull: false, field: 'college_phone' },
  officeLocation: { type: DataTypes.STRING(255), allowNull: false, field: 'office_location' },
  representativeFullName: { type: DataTypes.STRING(255), allowNull: false, field: 'representative_full_name' },
  representativeUsername: { type: DataTypes.STRING(100), allowNull: false, field: 'representative_username' },
  reservedUsername: { type: DataTypes.STRING(100), allowNull: true, unique: true, field: 'reserved_username' },
  representativeEmail: { type: DataTypes.STRING(255), allowNull: false, field: 'representative_email' },
  reservedEmail: { type: DataTypes.STRING(255), allowNull: true, unique: true, field: 'reserved_email' },
  representativePhone: { type: DataTypes.STRING(50), allowNull: false, field: 'representative_phone' },
  representativePasswordHash: { type: DataTypes.STRING(255), allowNull: true, field: 'representative_password_hash' },
  statusTokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'status_token_hash' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
  submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'submitted_at' },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
}, {
  tableName: 'college_registration_applications',
  timestamps: true,
  indexes: [
    { fields: ['status', 'submitted_at'] },
  ],
});

module.exports = CollegeRegistrationApplication;
