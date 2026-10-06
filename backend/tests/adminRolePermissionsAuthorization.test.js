const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const passport = require("../src/config/passport");
const models = require("../src/models");
const { requireAuth, requireRole, requirePermission } = require("../src/middlewares/auth");
const adminRoleRoutes = require("../src/routes/adminRoleRoutes");
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require("../src/constants/rolePermissions");

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

test("authentication handles MySQL TINYINT active values without weakening access", async () => {
  const originalAuthenticate = passport.authenticate;
  const originalFindByPk = models.Config.findByPk;
  let activeValue = "0";
  passport.authenticate = (_strategy, _options, callback) => (req, res, next) => callback(null, {
    id: 42,
    role: "admin",
    active: activeValue,
  });
  models.Config.findByPk = async () => null;

  try {
    const deactivated = await runMiddleware(requireAuth, { headers: {} });
    assert.equal(deactivated.status, 403);

    activeValue = 1;
    const active = await runMiddleware(requireAuth, { headers: {} });
    assert.equal(active.next, true);
  } finally {
    passport.authenticate = originalAuthenticate;
    models.Config.findByPk = originalFindByPk;
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

test("permission catalog includes every permission required by active routes", () => {
  for (const permission of [
    "assets.transfer.approve",
    "college.approvals.approve",
    "college.documents.manage",
    "college.verification.manage",
  ]) {
    assert.ok(PERMISSIONS.includes(permission), `${permission} must be editable in the role matrix`);
  }
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes("assets.transfer.approve"));
});

test("permission updates persist configuration and audit together in a transaction", async () => {
  const route = getRoute("put", "/roles/:role/permissions");
  assert.ok(route);
  const handler = route.stack[3].handle;
  const originalFindByPk = models.Config.findByPk;
  const originalFindOrCreate = models.Config.findOrCreate;
  const originalTransaction = models.sequelize.transaction;
  const originalAuditCreate = models.AuditLog.create;
  let savedValue;
  let auditRecord;
  let transactionArgument;
  const transaction = { id: "test-transaction" };

  models.Config.findByPk = async (key) => key === "role_permissions"
    ? { value: JSON.stringify({ staff: ["assets.view"] }) }
    : null;
  models.Config.findOrCreate = async ({ transaction: suppliedTransaction }) => {
    transactionArgument = suppliedTransaction;
    return [{
      value: JSON.stringify({ staff: ["assets.view"] }),
      async update(values, options) {
        savedValue = values.value;
        transactionArgument = options.transaction;
      },
    }];
  };
  models.sequelize.transaction = async (callback) => callback(transaction);
  models.AuditLog.create = async (record, options) => {
    auditRecord = { record, transaction: options.transaction };
    return record;
  };

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await handler({
      params: { role: "staff" },
      body: { permissions: ["assets.view", "reports.view"] },
      user: { id: 42, role: "admin" },
    }, res, (error) => { if (error) throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(savedValue).staff, ["assets.view", "reports.view"]);
    assert.equal(transactionArgument, transaction);
    assert.equal(auditRecord.transaction, transaction);
    assert.equal(auditRecord.record.action, "CHANGE_PERMISSION");
    assert.deepEqual(JSON.parse(auditRecord.record.details).old_value, ["assets.view"]);
    assert.deepEqual(JSON.parse(auditRecord.record.details).new_value, ["assets.view", "reports.view"]);
  } finally {
    models.Config.findByPk = originalFindByPk;
    models.Config.findOrCreate = originalFindOrCreate;
    models.sequelize.transaction = originalTransaction;
    models.AuditLog.create = originalAuditCreate;
  }
});
