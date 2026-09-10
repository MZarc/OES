import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthError,
  getSafeErrorMessage,
} from '@/lib/errors';
import { safeServerAction } from '@/lib/actions/safeAction';

describe('Error Handling & Sanitization Suite', () => {
  it('instantiates custom AppError classes with operational status codes', () => {
    const err = new ValidationError('Invalid employee email');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.isOperational).toBe(true);

    const authErr = new AuthError();
    expect(authErr.statusCode).toBe(401);
    expect(authErr.code).toBe('UNAUTHORIZED');
  });

  it('sanitizes raw database connection errors into user-friendly messages', () => {
    const rawDbError = new Error('connect ECONNREFUSED 127.0.0.1:5432 - postgres database unreachable');
    const safeMsg = getSafeErrorMessage(rawDbError);
    expect(safeMsg).toBe('Database or backend service is currently busy. Please retry in a moment.');

    const duplicateError = new Error('duplicate key value violates unique constraint "users_email_unique"');
    expect(getSafeErrorMessage(duplicateError)).toBe('A record with this information already exists.');
  });

  it('safeServerAction wraps successful results', async () => {
    const res = await safeServerAction('testAction', async () => {
      return { id: 123, status: 'OK' };
    });

    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 123, status: 'OK' });
    expect(res.error).toBeUndefined();
  });

  it('safeServerAction catches unexpected exceptions and formats safe error response', async () => {
    const res = await safeServerAction('failingAction', async () => {
      throw new ValidationError('Requested date range exceeds 31 days.');
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Requested date range exceeds 31 days.');
    expect(res.code).toBe('VALIDATION_ERROR');
  });
});
