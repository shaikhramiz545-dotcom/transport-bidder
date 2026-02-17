/**
 * Structured Logging Middleware
 * Logs requests in JSON format with duration and status.
 */
const logger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Hook into response finish to log the result
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logData = {
      level: statusCode >= 400 ? 'error' : 'info',
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(logData));
  });

  next();
};

module.exports = logger;
