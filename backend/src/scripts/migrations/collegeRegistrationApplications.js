const { sequelize, CollegeRegistrationApplication } = require('../../models');

const up = async () => {
  const queryInterface = sequelize.getQueryInterface();
  if (await queryInterface.tableExists('college_registration_applications')) return false;
  await CollegeRegistrationApplication.sync({ force: false });
  return true;
};

if (require.main === module) {
  up().then((created) => console.log(created
    ? 'College registration applications table created.'
    : 'College registration applications table already exists; no changes made.'))
    .catch((error) => {
      console.error(`College registration migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { up };
