import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g. 'EMPLOYEE_CREATED', 'OT_APPROVED', etc.
  entityType: text('entity_type').notNull(), // 'OT_RECORD', 'EXPENSE', 'EMPLOYEE', 'SHIFT', etc.
  entityId: text('entity_id').notNull(),
  beforeData: text('before_data'), // JSON stringified
  afterData: text('after_data'),   // JSON stringified
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
