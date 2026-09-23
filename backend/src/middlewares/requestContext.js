const crypto = require('crypto');
const { AsyncLocalStorage } = require('node:async_hooks');

const requestContextStorage = new AsyncLocalStorage();

const normalizeContext = (context = {}) => ({
  ...context,
  requestId: context.requestId || context.request_id || null,
  ipAddress: context.ipAddress || context.ip || null,
  userAgent: context.userAgent || context.user_agent || null,
});

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return String(forwardedFor[0]).trim();
  }

  return req.socket?.remoteAddress || req.ip || null;
};

const getRequestContext = () => requestContextStorage.getStore() || null;

const withRequestContext = (context, callback) => {
  if (!context || typeof callback !== 'function') {
    return callback();
  }

  return requestContextStorage.run(normalizeContext(context), callback);
};

const requestContextMiddleware = (req, res, next) => {
  const context = normalizeContext({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    method: req.method,
    path: req.originalUrl || req.url || null,
    userId: req.user?.id || null,
  });

  req.requestId = context.requestId;
  req.clientIp = context.ipAddress;
  req.userAgent = context.userAgent;
  req.auditContext = context;

  return withRequestContext(context, next);
};

module.exports = {
  requestContextMiddleware,
  getRequestContext,
  withRequestContext,
  getClientIp,
  normalizeContext,
};
