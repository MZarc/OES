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

export async function ensureDemoAccountAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const demoEmail = 'demo@oes.com';
    const hashedPassword = await hashPassword('demo123456');

    // 1. Ensure GENERAL shift exists
    let generalShift = await db.query.shifts.findFirst({
      where: eq(shifts.code, 'GENERAL'),
    });

    if (!generalShift) {
      await db.insert(shifts).values({
        id: 'shift_general_v1',
        code: 'GENERAL',
        name: 'General Shift',
        startTime: '08:30',
        endTime: '17:15',
        regularOtStartTime: '17:30',
        crossesMidnight: false,
        version: '2026-v1',
        active: true,
      }).onConflictDoNothing();
      generalShift = await db.query.shifts.findFirst({ where: eq(shifts.code, 'GENERAL') });
    }

    const shiftId = generalShift ? generalShift.id : 'shift_general_v1';

    // 2. Ensure user demo@oes.com exists with SUPER_ADMIN role
    let demoUser = await db.query.users.findFirst({
      where: eq(users.email, demoEmail),
    });

    const demoUserId = demoUser ? demoUser.id : 'usr_demo_sandbox';

    if (!demoUser) {
      await db.insert(users).values({
        id: demoUserId,
        name: 'Demo Sandbox User',
        email: demoEmail,
        emailVerified: true,
        role: 'SUPER_ADMIN',
      });
    } else if (demoUser.role !== 'SUPER_ADMIN') {
      await db.update(users).set({ role: 'SUPER_ADMIN', name: 'Demo Sandbox User' }).where(eq(users.id, demoUserId));
    }

    // 3. Ensure credential account exists with password demo123456
    const existingAcc = await db.query.accounts.findFirst({
      where: eq(accounts.userId, demoUserId),
    });

    if (existingAcc) {
      await db.update(accounts).set({ password: hashedPassword }).where(eq(accounts.id, existingAcc.id));
    } else {
      await db.insert(accounts).values({
        id: 'acc_demo_sandbox',
        userId: demoUserId,
        accountId: demoUserId,
        providerId: 'credential',
        password: hashedPassword,
      });
    }

    // 4. Ensure linked employee profile DEMO001 exists
    const existingEmp = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, demoUserId),
    });

    if (!existingEmp) {
      await db.insert(employeeProfiles).values({
        id: 'emp_demo_sandbox',
        userId: demoUserId,
        employeeCode: 'DEMO001',
        fullName: 'Demo Sandbox User',
        email: demoEmail,
        department: 'Engineering',
        designation: 'Demo Admin & Employee',
        shiftId,
        status: 'ACTIVE',
        dateJoined: '2026-01-01',
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to ensure demo account:', error);
    return { success: false, error: error.message || 'Failed to prepare demo account.' };
  }
}
