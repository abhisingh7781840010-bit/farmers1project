/**
 * Standardized API response helpers for consistent JSON responses across all endpoints
 */
class ApiResponse {
  static success(res, message = 'Success', data = null, statusCode = 200) {
    const payload = {
      success: true,
      message,
      data
    };
    return res.status(statusCode).json(payload);
  }

  static created(res, message = 'Resource created successfully', data = null) {
    return this.success(res, message, data, 201);
  }

  static error(res, message = 'An error occurred', statusCode = 500, errors = null) {
    const payload = {
      success: false,
      message,
      ...(errors && { errors })
    };
    return res.status(statusCode).json(payload);
  }

  static badRequest(res, message = 'Bad Request', errors = null) {
    return this.error(res, message, 400, errors);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Forbidden: insufficient permissions') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static conflict(res, message = 'Conflict detected', errors = null) {
    return this.error(res, message, 409, errors);
  }
}

module.exports = ApiResponse;
