const env = require("../config/env");

function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || 500;
  const payload = {
    message: error.message || "Server error"
  };

  if (error.details) payload.details = error.details;
  if (env.nodeEnv !== "production") payload.stack = error.stack;

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
