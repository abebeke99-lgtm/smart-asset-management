// Keep the package entry point aligned with the real database-backed API.
const app = require('./src/app');

// src/app starts itself when invoked directly; this entry point must do the same.
if (typeof app.startServer === 'function') {
	app.startServer().catch((error) => {
		console.error('Application startup failed:', error);
		process.exitCode = 1;
	});
}