import { db, sqlClient } from './client';
import {
  shifts,
  holidays,
  otRules,
  expenseCategories,
  users,
  accounts,
  employeeProfiles,
  otRecords,
  expenses,
} from './schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Shifts
  const initialShifts = [
    {
      id: 'shift_first_v1',
      code: 'FIRST',
      name: 'First Shift',
      startTime: '07:00',
      endTime: '15:00',
      regularOtStartTime: '15:00',
      crossesMidnight: false,
      version: '2026-v1',
      active: true,
    },
    {
      id: 'shift_general_v1',
      code: 'GENERAL',
      name: 'General Shift',
      startTime: '08:30',
      endTime: '17:15',
      regularOtStartTime: '17:30',
      crossesMidnight: false,
      version: '2026-v1',
      active: true,
    },
    {
      id: 'shift_second_v1',
      code: 'SECOND',
      name: 'Second Shift',
      startTime: '15:00',
      endTime: '23:00',
      regularOtStartTime: '23:00',
      crossesMidnight: false,
      version: '2026-v1',
      active: true,
    },
    {
      id: 'shift_night_v1',
      code: 'NIGHT',
      name: 'Night Shift',
      startTime: '23:00',
      endTime: '07:00',
      regularOtStartTime: '07:00',
      crossesMidnight: true,
      version: '2026-v1',
      active: true,
    },
  ];

  for (const s of initialShifts) {
    await db.insert(shifts).values(s).onConflictDoNothing();
  }
  console.log('✅ Shifts seeded');

  // 2. Seed OT Rules
  await db
    .insert(otRules)
    .values({
      id: 'ot_rule_2026_v1',
      version: '2026-v1',
      weekdayMultiplier: 1.0,
      sundayMultiplier: 1.25,
      holidayMultiplier: 1.25,
      roundingPolicy: 'UP_TO_NEXT_1_HOUR',
      timezone: 'Asia/Kolkata',
      minOtMinutes: 0,
      isCurrent: true,
    })
    .onConflictDoNothing();
  console.log('✅ OT Rules seeded');

  // 3. Seed 2026 Holidays
  const initialHolidays = [
    {
      id: 'hol_2026_01',
      date: '2026-01-26',
      name: 'Republic Day',
      type: 'NATIONAL_HOLIDAY',
      calendarVersion: '2026',
      active: true,
    },
    {
      id: 'hol_2026_02',
      date: '2026-08-15',
      name: 'Independence Day',
      type: 'NATIONAL_HOLIDAY',
      calendarVersion: '2026',
      active: true,
    },
    {
      id: 'hol_2026_03',
      date: '2026-10-02',
      name: 'Gandhi Jayanti',
      type: 'NATIONAL_HOLIDAY',
      calendarVersion: '2026',
      active: true,
    },
    {
      id: 'hol_2026_04',
      date: '2026-11-08',
      name: 'Diwali',
      type: 'COMPANY_HOLIDAY',
      calendarVersion: '2026',
      active: true,
    },
    {
      id: 'hol_2026_05',
      date: '2026-12-25',
      name: 'Christmas',
      type: 'COMPANY_HOLIDAY',
      calendarVersion: '2026',
      active: true,
    },
  ];

  for (const h of initialHolidays) {
    await db.insert(holidays).values(h).onConflictDoNothing();
  }
  console.log('✅ Holidays seeded');

  // 4. Seed Expense Categories
  const categories = [
    'Travel',
    'Food',
    'Accommodation',
    'Transport',
    'Office Supplies',
    'Communication',
    'Medical',
    'Other',
  ];

  for (const cat of categories) {
    await db
      .insert(expenseCategories)
      .values({
        id: `cat_${cat.toLowerCase().replace(/\s+/g, '_')}`,
        name: cat,
        description: `Expenses relating to ${cat}`,
        active: true,
      })
      .onConflictDoNothing();
  }
  console.log('✅ Expense Categories seeded');

  // 5. Seed Super Admin User
  const adminEmail = 'admin@oes.local';
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (!existingAdmin) {
    const adminId = 'usr_admin_001';
    await db.insert(users).values({
      id: adminId,
      name: 'Super Administrator',
      email: adminEmail,
      emailVerified: true,
      role: 'SUPER_ADMIN',
    });

    // Create credential account with Better Auth hashed password
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword('Admin@123456');

    await db.insert(accounts).values({
      id: 'acc_admin_001',
      userId: adminId,
      accountId: adminId,
      providerId: 'credential',
      password: hashedPassword,
    });

    // Create admin employee profile
    await db.insert(employeeProfiles).values({
      id: 'emp_admin_001',
      userId: adminId,
      employeeCode: 'ADM001',
      fullName: 'Super Administrator',
      email: adminEmail,
      department: 'Administration',
      designation: 'System Administrator',
      shiftId: 'shift_general_v1',
      status: 'ACTIVE',
      dateJoined: '2026-01-01',
    });

    console.log('✅ Super Admin account seeded (admin@oes.local)');
  }

  // 6. Seed Demo Employees for Testing Workflow
  const { hashPassword } = await import('better-auth/crypto');
  const demoEmpPassword = await hashPassword('Employee@123');

  const demoEmployees = [
    {
      userId: 'usr_emp_001',
      employeeId: 'emp_001',
      code: 'EMP001',
      name: 'Meet Mistry',
      email: 'meet@oes.local',
      department: 'Engineering',
      designation: 'Senior Engineer',
      shiftId: 'shift_first_v1', // 07:00 - 15:00
    },
    {
      userId: 'usr_emp_002',
      employeeId: 'emp_002',
      code: 'EMP002',
      name: 'John Wick',
      email: 'john.wick@oes.local',
      department: 'Production',
      designation: 'Production Supervisor',
      shiftId: 'shift_general_v1', // 08:30 - 17:15
    },
    {
      userId: 'usr_emp_003',
      employeeId: 'emp_003',
      code: 'EMP003',
      name: 'Bruce Wayne',
      email: 'bruce.wayne@oes.local',
      department: 'Assembly',
      designation: 'Assembly Specialist',
      shiftId: 'shift_night_v1', // 23:00 - 07:00
    },
  ];

  for (const emp of demoEmployees) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, emp.email),
    });

    if (!existing) {
      // 1. Create user
      await db.insert(users).values({
        id: emp.userId,
        name: emp.name,
        email: emp.email,
        emailVerified: true,
        role: 'EMPLOYEE',
      });

      // 2. Create credentials account
      await db.insert(accounts).values({
        id: `acc_${emp.code.toLowerCase()}`,
        userId: emp.userId,
        accountId: emp.userId,
        providerId: 'credential',
        password: demoEmpPassword,
      });

      // 3. Create employee profile
      await db.insert(employeeProfiles).values({
        id: emp.employeeId,
        userId: emp.userId,
        employeeCode: emp.code,
        fullName: emp.name,
        email: emp.email,
        department: emp.department,
        designation: emp.designation,
        shiftId: emp.shiftId,
        status: 'ACTIVE',
        dateJoined: '2026-01-15',
      });

      console.log(`✅ Demo Employee seeded: ${emp.name} (${emp.email} / Employee@123)`);
    }
  }

  // 7. Seed Sample Submissions for Instant Testing
  const today = new Date().toISOString().split('T')[0];
  
  // Sample Pending OT for Meet Mistry (07:00 -> 19:00, First Shift = 4h OT)
  const existingOt = await db.query.otRecords.findFirst({
    where: eq(otRecords.employeeId, 'emp_001'),
  });

  if (!existingOt) {
    await db.insert(otRecords).values({
      id: 'ot_demo_001',
      employeeId: 'emp_001',
      workDate: today,
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

    // Sample Pending Expense for Meet Mistry
    await db.insert(expenses).values({
      id: 'exp_demo_001',
      employeeId: 'emp_001',
      expenseDate: today,
      categoryName: 'Travel',
      amount: 850,
      description: 'Travel cab fare to supplier facility for QA inspection',
      status: 'SUBMITTED',
      isFlaggedDuplicate: false,
    });

    // Sample Pending Expense for John Wick (Flagged duplicate test)
    await db.insert(expenses).values({
      id: 'exp_demo_002',
      employeeId: 'emp_002',
      expenseDate: today,
      categoryName: 'Food',
      amount: 450,
      description: 'Team dinner during night overtime shift',
      status: 'SUBMITTED',
      isFlaggedDuplicate: false,
    });

    console.log('✅ Sample pending OT and Expense records seeded for testing approvals!');
  }

  console.log('🎉 Seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      sqlClient.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      sqlClient.end();
      process.exit(1);
    });
}
