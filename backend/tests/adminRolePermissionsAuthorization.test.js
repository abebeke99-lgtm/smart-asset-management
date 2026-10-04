const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const passport = require("../src/config/passport");
const models = require("../src/models");
const adminRoleRoutes = require("../src/routes/adminRoleRoutes");

const withServer = async (run) => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoleRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

test("role and permission APIs return 401 when called without authentication", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/roles`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Authentication required",
    });
  });
});

test("role and permission APIs reject authenticated non-administrators with 403", async () => {
  const originalAuthenticate = passport.authenticate;
  const originalFindByPk = models.Config.findByPk;
  passport.authenticate = (_strategy, _options, callback) => (req, res, next) => {
    const user = { id: 42, role: "ict_officer", active: true };
    if (callback) return callback(null, user);
    req.user = user;
    return next();
  };
  models.Config.findByPk = async (key) => key === "role_permissions"
    ? { value: JSON.stringify({ ict_officer: ["assets.view"] }) }
    : null;

  try {
    await withServer(async (baseUrl) => {
      const reads = await fetch(`${baseUrl}/api/admin/roles`);
      const updates = await fetch(`${baseUrl}/api/admin/roles/ict_officer/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: [] }),
      });
      assert.equal(reads.status, 403);
      assert.equal(updates.status, 403);
      assert.deepEqual(await updates.json(), {
        success: false,
        message: "Access denied for this role",
      });
    });
  } finally {
    passport.authenticate = originalAuthenticate;
    models.Config.findByPk = originalFindByPk;
  }
});
