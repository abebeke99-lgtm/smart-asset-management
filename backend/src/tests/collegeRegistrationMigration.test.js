const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, CollegeRegistrationApplication } = require('../models');
const { up } = require('../scripts/migrations/collegeRegistrationApplications');

test('college registration migration leaves an existing table untouched', async (t) => {
  const originalGetQueryInterface = sequelize.getQueryInterface;
  const originalSync = CollegeRegistrationApplication.sync;
  let syncCalled = false;
  sequelize.getQueryInterface = () => ({ tableExists: async () => true });
  CollegeRegistrationApplication.sync = async () => { syncCalled = true; };
  t.after(() => {
    sequelize.getQueryInterface = originalGetQueryInterface;
    CollegeRegistrationApplication.sync = originalSync;
  });

  assert.equal(await up(), false);
  assert.equal(syncCalled, false);
});

test('college registration migration creates only the missing application table', async (t) => {
  const originalGetQueryInterface = sequelize.getQueryInterface;
  const originalSync = CollegeRegistrationApplication.sync;
  let syncOptions;
  sequelize.getQueryInterface = () => ({ tableExists: async () => false });
  CollegeRegistrationApplication.sync = async (options) => { syncOptions = options; };
  t.after(() => {
    sequelize.getQueryInterface = originalGetQueryInterface;
    CollegeRegistrationApplication.sync = originalSync;
  });

  assert.equal(await up(), true);
  assert.deepEqual(syncOptions, { force: false });
});
