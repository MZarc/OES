import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const holidays = pgTable('holidays', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // "YYYY-MM-DD"
  name: text('name').notNull(),
  type: text('type').notNull(), // 'COMPANY_HOLIDAY' | 'NATIONAL_HOLIDAY' | 'SPECIAL_HOLIDAY' | 'OPTIONAL_HOLIDAY'
  calendarVersion: text('calendar_version').default('2026').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
