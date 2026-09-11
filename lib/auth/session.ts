import { headers } from 'next/headers';
import { auth } from './index';
import { db } from '@/db/client';
import { employeeProfiles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { isDemoEmail, provisionDemoSessionSandbox, getDemoEmployeeId } from './demo-sandbox';

export interface AuthenticatedContext {
  session?: {
    id: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN' | string;
  };
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    department?: string | null;
    shiftId: string;
    status: string;
  } | null;
}

/**
 * Retrieves the currently authenticated user session from request headers
 */
export async function getCurrentSession(): Promise<AuthenticatedContext | null> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return null;
    }

    const sessionId = session.session.id;
    let empProfile;

    if (isDemoEmail(session.user.email)) {
      const demoEmpId = getDemoEmployeeId(sessionId);
      empProfile = await db.query.employeeProfiles.findFirst({
        where: eq(employeeProfiles.id, demoEmpId),
      });

      if (!empProfile) {
        await provisionDemoSessionSandbox(sessionId);
        empProfile = await db.query.employeeProfiles.findFirst({
          where: eq(employeeProfiles.id, demoEmpId),
        });
      }
    } else {
      empProfile = await db.query.employeeProfiles.findFirst({
        where: eq(employeeProfiles.userId, session.user.id),
      });
    }

    return {
      session: {
        id: sessionId,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as { role?: string }).role || 'EMPLOYEE',
      },
      employee: empProfile
        ? {
            id: empProfile.id,
            employeeCode: isDemoEmail(session.user.email) ? 'DEMO001' : empProfile.employeeCode,
            fullName: empProfile.fullName,
            department: empProfile.department,
            shiftId: empProfile.shiftId,
            status: empProfile.status,
          }
        : null,
    };
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    console.error('Session retrieval error:', error);
    return null;
  }
}

/**
 * Asserts the request has a valid logged-in user
 */
export async function requireAuth(): Promise<AuthenticatedContext> {
  const ctx = await getCurrentSession();
  if (!ctx) {
    throw new Error('UNAUTHORIZED: Authentication required.');
  }
  return ctx;
}

/**
 * Asserts the user is an ADMIN or SUPER_ADMIN
 */
export async function requireAdmin(): Promise<AuthenticatedContext> {
  const ctx = await requireAuth();
  if (ctx.user.role !== 'ADMIN' && ctx.user.role !== 'SUPER_ADMIN') {
    throw new Error('FORBIDDEN: Administrative privileges required.');
  }
  return ctx;
}

/**
 * Asserts the user is a SUPER_ADMIN
 */
export async function requireSuperAdmin(): Promise<AuthenticatedContext> {
  const ctx = await requireAuth();
  if (ctx.user.role !== 'SUPER_ADMIN') {
    throw new Error('FORBIDDEN: Super Administrator privileges required.');
  }
  return ctx;
}
