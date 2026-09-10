import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // 'FIRST', 'GENERAL', 'SECOND', 'NIGHT'
  name: text('name').notNull(),
  startTime: text('start_time').notNull(), // "07:00"
  endTime: text('end_time').notNull(),     // "15:00"
  regularOtStartTime: text('regular_ot_start_time').notNull(), // "15:00"
  crossesMidnight: boolean('crosses_midnight').default(false).notNull(),
  version: text('version').default('2026-v1').notNull(),
  active: boolean('active').default(true).notNull(),
  activeFrom: timestamp('active_from').defaultNow().notNull(),
  activeUntil: timestamp('active_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shiftVersions = pgTable('shift_versions', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  regularOtStartTime: text('regular_ot_start_time').notNull(),
  crossesMidnight: boolean('crosses_midnight').default(false).notNull(),
  changedBy: text('changed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
