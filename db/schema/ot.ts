import { pgTable, text, timestamp, boolean, real } from 'drizzle-orm/pg-core';
import { employeeProfiles } from './employees';
import { shifts } from './shifts';
import { users } from './auth';

export const otRecords = pgTable('ot_records', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employeeProfiles.id, { onDelete: 'cascade' }),
  workDate: text('work_date').notNull(), // "YYYY-MM-DD"
  startTime: text('start_time').notNull(), // "07:00"
  endTime: text('end_time').notNull(),     // "19:00"
  shiftId: text('shift_id')
    .notNull()
    .references(() => shifts.id),
  shiftVersion: text('shift_version').notNull(),
  ruleVersion: text('rule_version').notNull(),
  rawHours: real('raw_hours').notNull(),
  multiplier: real('multiplier').notNull(),
  payableHours: real('payable_hours').notNull(),
  isSunday: boolean('is_sunday').default(false).notNull(),
  isHoliday: boolean('is_holiday').default(false).notNull(),
  holidayName: text('holiday_name'),
  calculationSnapshot: text('calculation_snapshot').notNull(), // JSON string
  status: text('status').default('SUBMITTED').notNull(), // 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  rejectionReason: text('rejection_reason'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
