/**
 * Standard API Response Wrapper
 * Adds helper methods to res object for consistent responses.
 */
const responseWrapper = (req, res, next) => {
  // Success response helper
  res.jsonSuccess = (data = null, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      data,
      error: null
    });
  };

  // Error response helper
  res.jsonError = (message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) => {
    const response = {
      success: false,
      message,
      data: null,
      error: {
        message,
        code
      }
    };
    
    if (details && process.env.NODE_ENV !== 'production') {
      response.error.details = details;
    }

    res.status(statusCode).json(response);
  };

  next();
};

module.exports = responseWrapper;
