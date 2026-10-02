require('dotenv').config();
require('../models');

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const { resolveDemoPassword } = require('../config/seed');
const { resolveLoginAliases, generateToken } = require('../controllers/authController');

async function verifyFinanceAuthentication() {
  const password = resolveDemoPassword();
  const aliases = resolveLoginAliases('finance');
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { username: aliases },
        { email: aliases },
      ],
    },
  });

  if (!user || user.role !== 'finance' || !user.active) return false;
  if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return false;
  if (!(await bcrypt.compare(password, user.password))) return false;

  return typeof (await generateToken(user)) === 'string';
}

verifyFinanceAuthentication()
  .then((verified) => {
    console.log(verified ? 'Finance authentication succeeded.' : 'Finance authentication failed.');
    if (!verified) process.exitCode = 1;
  })
  .catch(() => {
    console.error('Finance authentication verification failed.');
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());