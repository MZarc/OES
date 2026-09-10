'use server';

import { db } from '@/db/client';
import { users, accounts, employeeProfiles, shifts } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { logAuditEvent } from '@/lib/audit';
import crypto from 'crypto';

export async function checkSystemInitializedAction(): Promise<{ initialized: boolean }> {
  try {
    const adminCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const count = Number(adminCount[0]?.count ?? 0);
    return { initialized: count > 0 };
  } catch (error) {
    console.error('Failed to check system initialization state:', error);
    return { initialized: false };
  }
}

export async function initializeSuperAdminAction(formData: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { initialized } = await checkSystemInitializedAction();
    if (initialized) {
      return { success: false, error: 'System is already initialized. Please sign in.' };
    }

    const name = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!name || name.length < 2) {
      return { success: false, error: 'Please enter a valid full name.' };
    }

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Please enter a valid work email address.' };
    }

    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const accountId = `acc_${crypto.randomUUID()}`;
    const empId = `emp_${crypto.randomUUID()}`;

    const hashedPassword = await hashPassword(password);

    const generalShift = await db.query.shifts.findFirst({
      where: eq(shifts.code, 'GENERAL'),
    });

    const shiftId = generalShift ? generalShift.id : 'shift_general_v1';

    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      role: 'SUPER_ADMIN',
    });

    await db.insert(accounts).values({
      id: accountId,
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
    });

    await db.insert(employeeProfiles).values({
      id: empId,
      userId,
      employeeCode: 'ADM001',
      fullName: name,
      email,
      department: 'Executive',
      designation: 'Super Administrator',
      shiftId,
      status: 'ACTIVE',
      dateJoined: new Date().toISOString().split('T')[0],
    });

    await logAuditEvent({
      actorUserId: userId,
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      entityId: 'BOOTSTRAP',
      afterData: {
        adminEmail: email,
        adminName: name,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to initialize Super Admin:', error);
    return { success: false, error: error.message || 'Failed to initialize system.' };
  }
}
