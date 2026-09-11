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

    // 5. Ensure credential account exists with password demo123456
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

    // 6. Ensure linked employee profile DEMO001 exists
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
      });
    }

    // 7. Seed Demo Employees for Admin Roster Showcase
    const empPasswordHash = await hashPassword('Employee@123');
    const demoEmployeesList = [
      { userId: 'usr_emp_001', empId: 'emp_001', code: 'EMP001', name: 'Meet Mistry', email: 'meet@oes.local', dept: 'Engineering', desig: 'Senior Engineer', shift: 'shift_first_v1' },
      { userId: 'usr_emp_002', empId: 'emp_002', code: 'EMP002', name: 'John Wick', email: 'john.wick@oes.local', dept: 'Production', desig: 'Production Supervisor', shift: 'shift_general_v1' },
      { userId: 'usr_emp_003', empId: 'emp_003', code: 'EMP003', name: 'Bruce Wayne', email: 'bruce.wayne@oes.local', dept: 'Assembly', desig: 'Assembly Specialist', shift: 'shift_night_v1' },
    ];

    for (const e of demoEmployeesList) {
      const u = await db.query.users.findFirst({ where: eq(users.email, e.email) });
      if (!u) {
        await db.insert(users).values({ id: e.userId, name: e.name, email: e.email, emailVerified: true, role: 'EMPLOYEE' }).onConflictDoNothing();
        await db.insert(accounts).values({ id: `acc_${e.code.toLowerCase()}`, userId: e.userId, accountId: e.userId, providerId: 'credential', password: empPasswordHash }).onConflictDoNothing();
        await db.insert(employeeProfiles).values({ id: e.empId, userId: e.userId, employeeCode: e.code, fullName: e.name, email: e.email, department: e.dept, designation: e.desig, shiftId: e.shift, status: 'ACTIVE', dateJoined: '2026-01-15' }).onConflictDoNothing();
      }
    }

    // 8. Seed Prefilled OT Submissions for demo@oes.com & Team
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const lastSunday = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    const existingDemoOt = await db.query.otRecords.findFirst({
      where: eq(otRecords.employeeId, 'emp_demo_sandbox'),
    });

    if (!existingDemoOt) {
      // Demo User - Pending Claim
      await db.insert(otRecords).values({
        id: 'ot_demo_sand_001',
        employeeId: 'emp_demo_sandbox',
        workDate: today,
        startTime: '08:30',
        endTime: '20:45',
        shiftId: 'shift_general_v1',
        shiftVersion: '2026-v1',
        ruleVersion: '2026-v1',
        rawHours: 3.5,
        multiplier: 1.0,
        payableHours: 3.5,
        isSunday: false,
        isHoliday: false,
        calculationSnapshot: JSON.stringify({
          shiftName: 'General Shift',
          scheduledStart: '08:30',
          scheduledEnd: '17:15',
          otBoundary: '17:30',
          startTime: '08:30',
          endTime: '20:45',
          rawHours: 3.5,
          rawDurationMinutes: 210,
          multiplier: 1.0,
          payableHours: 3.5,
          ruleVersion: '2026-v1',
          shiftVersion: '2026-v1',
          calculatedAt: new Date().toISOString(),
        }),
        status: 'SUBMITTED',
      });

      // Demo User - Approved Claim
      await db.insert(otRecords).values({
        id: 'ot_demo_sand_002',
        employeeId: 'emp_demo_sandbox',
        workDate: threeDaysAgo,
        startTime: '08:30',
        endTime: '21:30',
        shiftId: 'shift_general_v1',
        shiftVersion: '2026-v1',
        ruleVersion: '2026-v1',
        rawHours: 4.0,
        multiplier: 1.0,
        payableHours: 4.0,
        isSunday: false,
        isHoliday: false,
        calculationSnapshot: JSON.stringify({
          shiftName: 'General Shift',
          scheduledStart: '08:30',
          scheduledEnd: '17:15',
          otBoundary: '17:30',
          startTime: '08:30',
          endTime: '21:30',
          rawHours: 4.0,
          rawDurationMinutes: 240,
          multiplier: 1.0,
          payableHours: 4.0,
          ruleVersion: '2026-v1',
          shiftVersion: '2026-v1',
          calculatedAt: new Date().toISOString(),
        }),
        status: 'APPROVED',
      });

      // Demo User - Sunday Multiplier Approved Claim
      await db.insert(otRecords).values({
        id: 'ot_demo_sand_003',
        employeeId: 'emp_demo_sandbox',
        workDate: lastSunday,
        startTime: '09:00',
        endTime: '14:00',
        shiftId: 'shift_general_v1',
        shiftVersion: '2026-v1',
        ruleVersion: '2026-v1',
        rawHours: 5.0,
        multiplier: 1.25,
        payableHours: 6.25,
        isSunday: true,
        isHoliday: false,
        calculationSnapshot: JSON.stringify({
          shiftName: 'General Shift',
          scheduledStart: '08:30',
          scheduledEnd: '17:15',
          otBoundary: '17:30',
          startTime: '09:00',
          endTime: '14:00',
          rawHours: 5.0,
          rawDurationMinutes: 300,
          multiplier: 1.25,
          payableHours: 6.25,
          ruleVersion: '2026-v1',
          shiftVersion: '2026-v1',
          calculatedAt: new Date().toISOString(),
        }),
        status: 'APPROVED',
      });

      // Other Team Member Pending OT (for Admin testing)
      await db.insert(otRecords).values({
        id: 'ot_demo_emp_001',
        employeeId: 'emp_001',
        workDate: yesterday,
        startTime: '07:00',
        endTime: '19:00',
        shiftId: 'shift_first_v1',
        shiftVersion: '2026-v1',
        ruleVersion: '2026-v1',
        rawHours: 4.0,
        multiplier: 1.0,
        payableHours: 4.0,
        isSunday: false,
        isHoliday: false,
        calculationSnapshot: JSON.stringify({
          shiftName: 'First Shift',
          scheduledStart: '07:00',
          scheduledEnd: '15:00',
          otBoundary: '15:00',
          startTime: '07:00',
          endTime: '19:00',
          rawHours: 4.0,
          rawDurationMinutes: 240,
          multiplier: 1.0,
          payableHours: 4.0,
          ruleVersion: '2026-v1',
          shiftVersion: '2026-v1',
          calculatedAt: new Date().toISOString(),
        }),
        status: 'SUBMITTED',
      });
    }

    // 9. Seed Prefilled Expense Claims for demo@oes.com & Team
    const existingDemoExp = await db.query.expenses.findFirst({
      where: eq(expenses.employeeId, 'emp_demo_sandbox'),
    });

    if (!existingDemoExp) {
      // Demo User - Pending Claim
      await db.insert(expenses).values({
        id: 'exp_demo_sand_001',
        employeeId: 'emp_demo_sandbox',
        expenseDate: today,
        categoryName: 'Travel',
        amount: 1250,
        description: 'Client site visit taxi fare & parking toll reimbursement',
        status: 'SUBMITTED',
        isFlaggedDuplicate: false,
      });

      // Demo User - Approved Claim
      await db.insert(expenses).values({
        id: 'exp_demo_sand_002',
        employeeId: 'emp_demo_sandbox',
        expenseDate: yesterday,
        categoryName: 'Food',
        amount: 680,
        description: 'Late night team dinner during system architecture deployment',
        status: 'APPROVED',
        isFlaggedDuplicate: false,
      });

      // Demo User - Approved Claim
      await db.insert(expenses).values({
        id: 'exp_demo_sand_003',
        employeeId: 'emp_demo_sandbox',
        expenseDate: threeDaysAgo,
        categoryName: 'Accommodation',
        amount: 3450,
        description: 'Outstation technical conference hotel room stay',
        status: 'APPROVED',
        isFlaggedDuplicate: false,
      });

      // Other Team Member Pending Expense (for Admin testing)
      await db.insert(expenses).values({
        id: 'exp_demo_emp_002',
        employeeId: 'emp_002',
        expenseDate: today,
        categoryName: 'Transport',
        amount: 450,
        description: 'Late night shift drop taxi fare',
        status: 'SUBMITTED',
        isFlaggedDuplicate: false,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to ensure demo account:', error);
    return { success: false, error: error.message || 'Failed to prepare demo account.' };
  }
}
