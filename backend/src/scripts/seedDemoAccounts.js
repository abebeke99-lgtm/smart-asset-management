require('dotenv').config();
require('../models');

const { sequelize } = require('../config/database');
const { seedDatabase, seedOperationalData } = require('../config/seed');

async function run() {
  await sequelize.authenticate();
  const counts = await seedDatabase();
  const operational = await seedOperationalData();
  console.log(`Demo account seeding completed: ${counts.created} created, ${counts.existing} already present.`);
  console.log(`Operational data seeding completed: ${operational.assets} assets, ${operational.assignments} assignments, ${operational.maintenances} maintenance records, ${operational.notifications} notifications.`);
}

run()
  .catch((error) => {
    console.error('Demo account seeding failed. Check database connectivity and seed configuration.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });