const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const passport = require("../src/config/passport");
const models = require("../src/models");
const { requireAuth, requireRole, requirePermission } = require("../src/middlewares/auth");
const adminRoleRoutes = require("../src/routes/adminRoleRoutes");

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve({ status: this.statusCode, body });
      return this;
    },
  };
  try {
    const result = middleware(req, res, (error) => {
      if (error) reject(error);
      else resolve({ status: res.statusCode, next: true });
    });
    result?.catch?.(reject);
  } catch (error) {
    reject(error);
  }
});

const getRoute = (method, routePath) => adminRoleRoutes.stack
  .find((layer) => layer.route?.path === routePath && layer.route.methods[method])
  ?.route;

test("role list API rejects missing authentication with a JSON 401", async () => {
  const originalAuthenticate = passport.authenticate;
  const route = getRoute("get", "/roles");
  assert.ok(route);
  passport.authenticate = (_strategy, _options, callback) => (req, res, next) => callback(null, false);
  try {
    const result = await runMiddleware(route.stack[0].handle, { headers: {} });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, {
      success: false,
      message: "Authentication required",
    });
  } finally {
    passport.authenticate = originalAuthenticate;
  }
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
    const route = getRoute("put", "/roles/:role/permissions");
    assert.ok(route);
    const req = { headers: {} };
    const auth = await runMiddleware(route.stack[0].handle, req);
    assert.equal(auth.next, true);
    const denied = await runMiddleware(route.stack[1].handle, req);
    assert.equal(denied.status, 403);
  } finally {
    passport.authenticate = originalAuthenticate;
    models.Config.findByPk = originalFindByPk;
  }
});

test("permission changes require the dedicated permission-management capability", async () => {
  const response = await runMiddleware(requirePermission("permissions.manage"), {
    user: { role: "admin", permissions: ["assets.view"] },
  });
  assert.equal(response.status, 403);

  const routeSource = fs.readFileSync(
    path.join(__dirname, "../src/routes/adminRoleRoutes.js"),
    "utf8",
  );
  assert.match(routeSource, /router\.put\('\/roles\/:role\/permissions', \.\.\.requireAdminPermission\('permissions\.manage'\)/);
  assert.match(routeSource, /router\.get\('\/roles', \.\.\.requireAdminPermission\('roles\.view'\)/);
  assert.match(routeSource, /router\.get\('\/permissions', \.\.\.requireAdminPermission\('permissions\.view'\)/);
});
