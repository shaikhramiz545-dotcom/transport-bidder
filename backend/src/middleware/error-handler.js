/**
 * Global Error Handler
 * Centralized error handling for the application.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  const logData = {
    level: 'error',
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  };
  
  // structured logging
  console.error(JSON.stringify(logData));

  // Determine status code
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  // Use the response wrapper if available, otherwise manual JSON
  if (res.jsonError) {
    return res.jsonError(message, code, statusCode, process.env.NODE_ENV !== 'production' ? err.stack : null);
  }

  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: {
      message,
      code
    }
  });
};

module.exports = errorHandler;
