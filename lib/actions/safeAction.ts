import { getSafeErrorMessage, logSystemError } from '@/lib/errors';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Executes an async server action within a standardized error boundary.
 * Logs unexpected exceptions on the server and returns a safe ActionResult object.
 */
export async function safeServerAction<T>(
  actionName: string,
  fn: () => Promise<T>,
  meta?: Record<string, any>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    logSystemError(`Action:${actionName}`, error, meta);
    const message = getSafeErrorMessage(error);
    const code = error?.code || 'ACTION_FAILED';
    return {
      success: false,
      error: message,
      code,
    };
  }
}

/**
 * Throws a safe client-facing error if an operational check fails inside server actions.
 */
export function assertOrThrow(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}
