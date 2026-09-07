/**
 * Centralized API Error Handling Middleware
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.message.includes('not found') ? 404 : 400);

  console.error(`❌ [API Error] ${req.method} ${req.originalUrl}:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
}

/**
 * 404 Route Not Found Handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /centers',
      'GET /centers/:id/schedule',
      'GET /centers/:id/queue',
      'GET /centers/:id/availability',
      'POST /farmer/token',
      'GET /farmer/status',
      'GET /farmer/waiting-time',
      'PUT /procurement/status',
      'PUT /centers/:id/schedule',
      'PUT /centers/:id/queue',
      'POST /notifications',
      'GET /notifications',
      'GET /events',
      'POST /auth/login',
      'GET /api-docs'
    ]
  });
}

export default { errorHandler, notFoundHandler };
