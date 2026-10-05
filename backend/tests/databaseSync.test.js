const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../src/models');
const { ensureUserRoleEnum } = require('../src/config/sync');

test('role enum synchronization skips ALTER when the canonical roles already exist', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originalDescribeTable = queryInterface.describeTable;
  const originalQuery = sequelize.query;
  let alterQueries = 0;

  queryInterface.describeTable = async () => ({
    role: {
      type: "ENUM('admin','ict_officer','college','college_manager','department_head','finance','store_manager','maintenance','infrastructure','teaching_assistant','staff','student')",
    },
  });
  sequelize.query = async (sql) => {
    if (/ALTER TABLE users/i.test(sql)) alterQueries += 1;
  };

  try {
    await ensureUserRoleEnum();
    assert.equal(alterQueries, 0);
  } finally {
    queryInterface.describeTable = originalDescribeTable;
    sequelize.query = originalQuery;
  }
});

test('role enum synchronization adds Teaching Assistant when the existing enum lacks it', { concurrency: false }, async () => {
  const queryInterface = sequelize.getQueryInterface();
  const originalDescribeTable = queryInterface.describeTable;
  const originalQuery = sequelize.query;
  let alterStatement = '';

  queryInterface.describeTable = async () => ({
    role: {
      type: "ENUM('admin','ict_officer','college','college_manager','department_head','finance','store_manager','maintenance','infrastructure','staff','student')",
    },
  });
  sequelize.query = async (sql) => {
    if (/ALTER TABLE users/i.test(sql)) alterStatement = sql;
  };

  try {
    await ensureUserRoleEnum();
    assert.match(alterStatement, /'teaching_assistant'/);
  } finally {
    queryInterface.describeTable = originalDescribeTable;
    sequelize.query = originalQuery;
  }
});
