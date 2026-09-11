import { db } from '@/db/client';
import { users, accounts, employeeProfiles, shifts, otRules, expenseCategories, otRecords, expenses } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function isDemoEmail(email?: string | null): boolean {
  return email?.toLowerCase().trim() === 'demo@oes.com';
}

export function getDemoEmployeeId(sessionId: string): string {
  return `emp_demo_${sessionId}`;
}

/**
 * Provisions a completely isolated sandbox workspace (employee profile, OT claims, expenses, team roster)
 * for a specific demo session ID.
 */
export async function provisionDemoSessionSandbox(sessionId: string): Promise<string> {
  const demoEmpId = getDemoEmployeeId(sessionId);

  // Check if session sandbox profile already exists
  const existing = await db.query.employeeProfiles.findFirst({
    where: eq(employeeProfiles.id, demoEmpId),
  });

  if (existing) {
    // Auto-heal existing session Sunday claim if date or snapshot was outdated
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
      const lastSunday = new Date(now.getTime() - daysSinceSunday * 86400000).toISOString().split('T')[0];

      await db.update(otRecords).set({
        workDate: lastSunday,
        isSunday: true,
        multiplier: 1.25,
        payableHours: 6.25,
        calculationSnapshot: JSON.stringify({
          workDate: lastSunday,
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
          isSunday: true,
          isHoliday: false,
          ruleVersion: '2026-v1',
          shiftVersion: '2026-v1',
          calculatedAt: new Date().toISOString(),
        }),
      }).where(eq(otRecords.id, `ot_demo_3_${sessionId}`));
    } catch (e) {
      console.warn('Auto-heal demo claim non-fatal error:', e);
    }
    return demoEmpId;
  }

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

  // 2. Ensure all 4 shifts exist
  const initialShifts = [
    { id: 'shift_first_v1', code: 'FIRST', name: 'First Shift', startTime: '07:00', endTime: '15:00', regularOtStartTime: '15:00', crossesMidnight: false, version: '2026-v1', active: true },
    { id: 'shift_general_v1', code: 'GENERAL', name: 'General Shift', startTime: '08:30', endTime: '17:15', regularOtStartTime: '17:30', crossesMidnight: false, version: '2026-v1', active: true },
    { id: 'shift_second_v1', code: 'SECOND', name: 'Second Shift', startTime: '15:00', endTime: '23:00', regularOtStartTime: '23:00', crossesMidnight: false, version: '2026-v1', active: true },
    { id: 'shift_night_v1', code: 'NIGHT', name: 'Night Shift', startTime: '23:00', endTime: '07:00', regularOtStartTime: '07:00', crossesMidnight: true, version: '2026-v1', active: true },
  ];
  for (const s of initialShifts) {
    await db.insert(shifts).values(s).onConflictDoNothing();
  }

  // 3. Ensure default OT Rules exist
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

  // 4. Ensure Expense Categories exist
  const categories = ['Travel', 'Food', 'Accommodation', 'Transport', 'Office Supplies', 'Communication', 'Medical', 'Other'];
  for (const cat of categories) {
    await db.insert(expenseCategories).values({
      id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
      name: cat,
      description: `Expenses relating to ${cat}`,
      active: true,
    }).onConflictDoNothing();
  }

  // 5. Ensure demo@oes.com user exists
  let demoUser = await db.query.users.findFirst({
    where: eq(users.email, 'demo@oes.com'),
  });
  const demoUserId = demoUser ? demoUser.id : 'usr_demo_sandbox';

  if (!demoUser) {
    await db.insert(users).values({
      id: demoUserId,
      name: 'Demo Sandbox User',
      email: 'demo@oes.com',
      emailVerified: true,
      role: 'SUPER_ADMIN',
    }).onConflictDoNothing();
  }

  // Clean up any old static profile
  await db.delete(employeeProfiles).where(eq(employeeProfiles.id, 'emp_demo_sandbox'));

  const safeSession = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'SESSION';
  const demoEmpCode = `DEMO_${safeSession}`;
  const demoEmpEmail = `demo_${safeSession}@oes.local`;

  // 6. Create Session-Isolated Employee Profile for demo@oes.com
  await db.insert(employeeProfiles).values({
    id: demoEmpId,
    userId: demoUserId,
    employeeCode: demoEmpCode,
    fullName: 'Demo Sandbox User',
    email: demoEmpEmail,
    department: 'Engineering',
    designation: 'Demo Admin & Employee',
    shiftId,
    status: 'ACTIVE',
    dateJoined: '2026-01-01',
  }).onConflictDoNothing();

  // 7. Create Session-Isolated Team Employee Profiles for Admin Roster Showcase
  const teamMembers = [
    { empId: `emp_001_${sessionId}`, code: `EMP1_${safeSession}`, name: 'Meet Mistry', email: `meet_${safeSession}@oes.local`, dept: 'Engineering', desig: 'Senior Engineer', shift: 'shift_first_v1' },
    { empId: `emp_002_${sessionId}`, code: `EMP2_${safeSession}`, name: 'John Wick', email: `john_${safeSession}@oes.local`, dept: 'Production', desig: 'Production Supervisor', shift: 'shift_general_v1' },
    { empId: `emp_003_${sessionId}`, code: `EMP3_${safeSession}`, name: 'Bruce Wayne', email: `bruce_${safeSession}@oes.local`, dept: 'Assembly', desig: 'Assembly Specialist', shift: 'shift_night_v1' },
  ];

  for (const m of teamMembers) {
    await db.insert(employeeProfiles).values({
      id: m.empId,
      userId: demoUserId,
      employeeCode: m.code,
      fullName: m.name,
      email: m.email,
      department: m.dept,
      designation: m.desig,
      shiftId: m.shift,
      status: 'ACTIVE',
      dateJoined: '2026-01-15',
    }).onConflictDoNothing();
  }

  // 8. Seed Prefilled OT Submissions for this session
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const lastSunday = new Date(now.getTime() - daysSinceSunday * 86400000).toISOString().split('T')[0];

  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0];

  // Demo User - Pending Claim (SUBMITTED)
  await db.insert(otRecords).values({
    id: `ot_demo_1_${sessionId}`,
    employeeId: demoEmpId,
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
      workDate: today,
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
      isSunday: false,
      isHoliday: false,
      ruleVersion: '2026-v1',
      shiftVersion: '2026-v1',
      calculatedAt: new Date().toISOString(),
    }),
    status: 'SUBMITTED',
  }).onConflictDoNothing();

  // Demo User - Approved Claim
  await db.insert(otRecords).values({
    id: `ot_demo_2_${sessionId}`,
    employeeId: demoEmpId,
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
      workDate: threeDaysAgo,
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
      isSunday: false,
      isHoliday: false,
      ruleVersion: '2026-v1',
      shiftVersion: '2026-v1',
      calculatedAt: new Date().toISOString(),
    }),
    status: 'APPROVED',
  }).onConflictDoNothing();

  // Demo User - Sunday Multiplier Approved Claim
  await db.insert(otRecords).values({
    id: `ot_demo_3_${sessionId}`,
    employeeId: demoEmpId,
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
      workDate: lastSunday,
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
      isSunday: true,
      isHoliday: false,
      ruleVersion: '2026-v1',
      shiftVersion: '2026-v1',
      calculatedAt: new Date().toISOString(),
    }),
    status: 'APPROVED',
  }).onConflictDoNothing();

  // Team Member Pending OT Claim (for Admin testing)
  await db.insert(otRecords).values({
    id: `ot_demo_team_1_${sessionId}`,
    employeeId: `emp_001_${sessionId}`,
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
      workDate: yesterday,
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
      isSunday: false,
      isHoliday: false,
      ruleVersion: '2026-v1',
      shiftVersion: '2026-v1',
      calculatedAt: new Date().toISOString(),
    }),
    status: 'SUBMITTED',
  }).onConflictDoNothing();

  // 9. Seed Prefilled Expense Claims for this session
  await db.insert(expenses).values({
    id: `exp_demo_1_${sessionId}`,
    employeeId: demoEmpId,
    expenseDate: today,
    categoryName: 'Travel',
    amount: 1250,
    description: 'Client site visit taxi fare & parking toll reimbursement',
    status: 'SUBMITTED',
    isFlaggedDuplicate: false,
  }).onConflictDoNothing();

  await db.insert(expenses).values({
    id: `exp_demo_2_${sessionId}`,
    employeeId: demoEmpId,
    expenseDate: yesterday,
    categoryName: 'Food',
    amount: 680,
    description: 'Late night team dinner during system architecture deployment',
    status: 'APPROVED',
    isFlaggedDuplicate: false,
  }).onConflictDoNothing();

  await db.insert(expenses).values({
    id: `exp_demo_3_${sessionId}`,
    employeeId: demoEmpId,
    expenseDate: threeDaysAgo,
    categoryName: 'Accommodation',
    amount: 3450,
    description: 'Outstation technical conference hotel room stay',
    status: 'APPROVED',
    isFlaggedDuplicate: false,
  }).onConflictDoNothing();

  // Team Member Pending Expense Claim (for Admin testing)
  await db.insert(expenses).values({
    id: `exp_demo_team_2_${sessionId}`,
    employeeId: `emp_002_${sessionId}`,
    expenseDate: today,
    categoryName: 'Transport',
    amount: 450,
    description: 'Late night shift drop taxi fare',
    status: 'SUBMITTED',
    isFlaggedDuplicate: false,
  }).onConflictDoNothing();

  return demoEmpId;
}
