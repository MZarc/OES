'use server';

import { db } from '@/db/client';
import { users, accounts, employeeProfiles, shifts, otRules, holidays, expenseCategories, otRecords, expenses } from '@/db/schema';
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

    // 1. Ensure all shifts exist
    const initialShifts = [
      { id: 'shift_first_v1', code: 'FIRST', name: 'First Shift', startTime: '07:00', endTime: '15:00', regularOtStartTime: '15:00', crossesMidnight: false, version: '2026-v1', active: true },
      { id: 'shift_general_v1', code: 'GENERAL', name: 'General Shift', startTime: '08:30', endTime: '17:15', regularOtStartTime: '17:30', crossesMidnight: false, version: '2026-v1', active: true },
      { id: 'shift_second_v1', code: 'SECOND', name: 'Second Shift', startTime: '15:00', endTime: '23:00', regularOtStartTime: '23:00', crossesMidnight: false, version: '2026-v1', active: true },
      { id: 'shift_night_v1', code: 'NIGHT', name: 'Night Shift', startTime: '23:00', endTime: '07:00', regularOtStartTime: '07:00', crossesMidnight: true, version: '2026-v1', active: true },
    ];
    for (const s of initialShifts) {
      await db.insert(shifts).values(s).onConflictDoNothing();
    }

    // 2. Ensure default OT Rules exist
    await db.insert(otRules).values({
      id: 'ot_rule_2026_v1',
      version: '2026-v1',
      weekdayMultiplier: 1.0,
      sundayMultiplier: 1.25,
      holidayMultiplier: 1.25,
      roundingPolicy: 'UP_TO_NEXT_1_HOUR',
      timezone: 'Asia/Kolkata',
      minOtMinutes: 0,
      isCurrent: true,
    }).onConflictDoNothing();

    // 3. Ensure Expense Categories exist
    const categories = ['Travel', 'Food', 'Accommodation', 'Transport', 'Office Supplies', 'Communication', 'Medical', 'Other'];
    for (const cat of categories) {
      await db.insert(expenseCategories).values({
        id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
        name: cat,
        description: `Expenses relating to ${cat}`,
        active: true,
      }).onConflictDoNothing();
    }

    // 4. Ensure demo@oes.com user exists with SUPER_ADMIN role
    let demoUser = await db.query.users.findFirst({
      where: eq(users.email, demoEmail),
    });

    let demoUserId: string;

    if (!demoUser) {
      demoUserId = 'usr_demo_sandbox';
      await db.delete(users).where(eq(users.id, demoUserId));
      await db.insert(users).values({
        id: demoUserId,
        name: 'Demo Sandbox User',
        email: demoEmail,
        emailVerified: true,
        role: 'SUPER_ADMIN',
      });
    } else {
      demoUserId = demoUser.id;
      await db.update(users).set({ role: 'SUPER_ADMIN', name: 'Demo Sandbox User', emailVerified: true }).where(eq(users.id, demoUserId));
    }

    // 5. Ensure credential account exists with password demo123456
    await db.delete(accounts).where(eq(accounts.userId, demoUserId));
    await db.insert(accounts).values({
      id: `acc_demo_${crypto.randomUUID()}`,
      userId: demoUserId,
      accountId: demoUserId,
      providerId: 'credential',
      password: hashedPassword,
    });

    // 6. Ensure base employee profile DEMO001 exists
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
        shiftId: 'shift_general_v1',
        status: 'ACTIVE',
        dateJoined: '2026-01-01',
      }).onConflictDoNothing();
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to ensure demo account:', error);
    return { success: false, error: error.message || 'Failed to prepare demo account.' };
  }
}
