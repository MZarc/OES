import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { shifts } from './shifts';

export const employeeProfiles = pgTable('employee_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  employeeCode: text('employee_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  department: text('department'),
  designation: text('designation'),
  shiftId: text('shift_id')
    .notNull()
    .references(() => shifts.id),
  status: text('status').default('PENDING_ACTIVATION').notNull(), // 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING_ACTIVATION'
  dateJoined: text('date_joined'),
  dateLeft: text('date_left'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
