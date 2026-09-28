/**
 * Centralized error handler for the Smart University Asset Management System.
 * Provides consistent error responses without exposing implementation details.
 */

const isProduction = process.env.NODE_ENV === 'production';

// Map common error types to HTTP status codes
const getErrorStatusCode = (err) => {
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') return 400;
  if (err.name === 'SequelizeForeignKeyConstraintError') return 409;
  if (err.name === 'JsonWebTokenError') return 401;
  if (err.name === 'TokenExpiredError') return 401;
  if (err.code === 'LIMIT_FILE_SIZE') return 413;
  return 500;
};

// Get user-friendly error message
const getErrorMessage = (err, statusCode) => {
  if (statusCode >= 500) {
    return isProduction ? 'Internal server error' : (err.message || 'Internal server error');
  }
  if (err.name === 'SequelizeValidationError') {
    return err.errors?.map((e) => e.message).join(', ') || 'Validation failed';
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return 'A record with this value already exists';
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return 'Cannot perform this operation due to existing references';
  }
  if (err.name === 'JsonWebTokenError') {
    return 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    return 'Authentication token has expired';
  }
  return err.message || 'Request failed';
};

const errorHandler = (err, req, res, next) => {
  const statusCode = getErrorStatusCode(err);
  const message = getErrorMessage(err, statusCode);

  // Log error details (but don't expose them to client)
  if (statusCode >= 500) {
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(statusCode < 500 && err.errors ? { errors: err.errors } : {}),
  });
};

module.exports = errorHandler;
