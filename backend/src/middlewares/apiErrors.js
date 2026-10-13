const apiNotFoundHandler = (_req, res) => {
  return res.status(404).json({ success: false, message: 'API endpoint not found' });
};

const apiErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
    ? err.status
    : Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  if (err?.code === 'CORS_ORIGIN_NOT_ALLOWED') {
    console.warn('Blocked a request from a disallowed CORS origin.');
    return res.status(403).json({
      success: false,
      code: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'Origin is not allowed',
    });
  }

  console.error('Server Error:', {
    requestId: req.requestId || null,
    operation: `${req.method} ${req.path}`,
    errorCategory: err.name || 'Error',
    name: err.name,
    message: err.message,
    code: err.original?.code || err.parent?.code || err.code,
    sqlMessage: err.original?.sqlMessage || err.parent?.sqlMessage,
    sql: err.sql || err.original?.sql,
    stack: err.stack,
    ip: req.ip,
  });
  return res.status(status).json({
    success: false,
    message: status >= 500 || process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Request failed'),
    ...(status < 500 && err.errors ? { errors: err.errors } : {}),
  });
};

module.exports = { apiErrorHandler, apiNotFoundHandler };
