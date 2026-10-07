module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.jest.cjs'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/controllers/departmentController.js',
    'src/middlewares/auth.js',
    'src/middlewares/organizationScope.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
