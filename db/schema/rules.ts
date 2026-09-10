import { pgTable, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';

export const otRules = pgTable('ot_rules', {
  id: text('id').primaryKey(),
  version: text('version').notNull().unique(), // e.g. "2026-v1"
  weekdayMultiplier: real('weekday_multiplier').default(1.0).notNull(),
  sundayMultiplier: real('sunday_multiplier').default(1.25).notNull(),
  holidayMultiplier: real('holiday_multiplier').default(1.25).notNull(),
  roundingPolicy: text('rounding_policy').default('UP_TO_NEXT_1_HOUR').notNull(),
  timezone: text('timezone').default('Asia/Kolkata').notNull(),
  minOtMinutes: integer('min_ot_minutes').default(0).notNull(),
  isCurrent: boolean('is_current').default(true).notNull(),
  effectiveFrom: timestamp('effective_from').defaultNow().notNull(),
  effectiveUntil: timestamp('effective_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
