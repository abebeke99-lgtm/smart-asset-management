// Database seed script - populate initial data
module.exports = {
  seedDatabase: async (models) => {
    try {
      console.log('Seeding database...');
      // Add seed logic here
      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Error seeding database:', error);
    }
  }
};
