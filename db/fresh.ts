import { db, sqlClient } from './client';
import {
  shifts,
  holidays,
  otRules,
  expenseCategories,
  users,
  accounts,
  sessions,
  employeeProfiles,
  otRecords,
  expenses,
  auditLogs,
  imports,
  importRows,
  verificationTokens,
} from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

export async function resetToFreshState() {
  console.log('🧹 Cleaning database to pristine fresh state...');

  // 1. Wipe test / runtime records in relational dependency order
  await db.delete(expenses);
  console.log('  ✓ Cleaned expenses');

  await db.delete(otRecords);
  console.log('  ✓ Cleaned OT records');

  await db.delete(auditLogs);
  console.log('  ✓ Cleaned audit logs');

  await db.delete(importRows);
  await db.delete(imports);
  console.log('  ✓ Cleaned import history');

  await db.delete(employeeProfiles);
  console.log('  ✓ Cleaned employee profiles');

  await db.delete(sessions);
  console.log('  ✓ Cleaned sessions');

  await db.delete(accounts);
  console.log('  ✓ Cleaned credential accounts');

  await db.delete(verificationTokens);
  console.log('  ✓ Cleaned tokens');

  await db.delete(users);
  console.log('  ✓ Cleaned user directory (0 users remaining)');

  // 2. Ensure baseline master company structure exists
  console.log('\n🏛️  Verifying company master infrastructure...');

  // Master Shifts
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
  console.log('  ✓ Verified default shift schedules');

  // Master OT Rules
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
  console.log('  ✓ Verified overtime calculation policy rules');

  // Master Holidays
  const initialHolidays = [
    { id: 'hol_2026_01', date: '2026-01-26', name: 'Republic Day', type: 'NATIONAL_HOLIDAY', calendarVersion: '2026', active: true },
    { id: 'hol_2026_02', date: '2026-08-15', name: 'Independence Day', type: 'NATIONAL_HOLIDAY', calendarVersion: '2026', active: true },
    { id: 'hol_2026_03', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'NATIONAL_HOLIDAY', calendarVersion: '2026', active: true },
    { id: 'hol_2026_04', date: '2026-11-08', name: 'Diwali', type: 'COMPANY_HOLIDAY', calendarVersion: '2026', active: true },
    { id: 'hol_2026_05', date: '2026-12-25', name: 'Christmas', type: 'COMPANY_HOLIDAY', calendarVersion: '2026', active: true },
  ];

  for (const h of initialHolidays) {
    await db.insert(holidays).values(h).onConflictDoNothing();
  }
  console.log('  ✓ Verified 2026 official holiday calendar');

  // Master Expense Categories
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
  console.log('  ✓ Verified expense reimbursement categories');

  console.log('\n✨ Database is now 100% clean and fresh for production!');
  console.log('👉 Visit your live app at /setup (e.g. https://oeslive.vercel.app/setup) to create your Super Administrator account.\n');

  await sqlClient.end();
}

resetToFreshState().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
