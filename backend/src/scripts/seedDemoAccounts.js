require('dotenv').config();
require('../models');

const { sequelize } = require('../config/database');
const { seedDatabase } = require('../config/seed');

async function run() {
  await sequelize.authenticate();
  const counts = await seedDatabase();
  console.log(`Demo account seeding completed: ${counts.created} created, ${counts.existing} already present.`);
}

run()
  .catch(() => {
    console.error('Demo account seeding failed. Check database connectivity and seed configuration.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });