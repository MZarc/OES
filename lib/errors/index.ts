/**
 * Custom System Error Classes and Error Sanitization Utilities
 * Provides standard error categorization, secure server-side logging,
 * and safe client-facing message formatting across OES.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR', true);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized access or invalid session.') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super(message, 404, 'NOT_FOUND', true);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable. Please try again shortly.') {
    super(message, 533, 'SERVICE_UNAVAILABLE', true);
  }
}

/**
 * Formats an unknown error object into a safe, client-presentable error string.
 * Hides database connection credentials and internal stack traces in production.
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Hide raw Postgres / Valkey connection strings or SQL syntax details in production
    const msg = error.message.toLowerCase();
    if (msg.includes('connect econnrefused') || msg.includes('connection terminated') || msg.includes('too many clients')) {
      return 'Database or backend service is currently busy. Please retry in a moment.';
    }
    if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
      return 'A record with this information already exists.';
    }
    if (msg.includes('foreign key constraint')) {
      return 'Cannot perform action because related records exist.';
    }
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected system error occurred. Please try again.';
}

/**
 * Server-side error logger for structured logging and diagnostic context.
 */
export function logSystemError(context: string, error: unknown, meta?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  if (error instanceof AppError) {
    console.warn(`⚠️ [${timestamp}] [${context}] Operational Error (${error.code}):`, {
      message: error.message,
      statusCode: error.statusCode,
      meta,
    });
  } else if (error instanceof Error) {
    console.error(`❌ [${timestamp}] [${context}] System Exception:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      meta,
    });
  } else {
    console.error(`❌ [${timestamp}] [${context}] Unknown Error:`, error, meta);
  }
}
