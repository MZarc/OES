import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const imports = pgTable('imports', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  fileHash: text('file_hash').notNull(),
  totalRows: integer('total_rows').notNull(),
  successCount: integer('success_count').notNull(),
  failureCount: integer('failure_count').notNull(),
  importedBy: text('imported_by').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').default('PROCESSED').notNull(), // 'PENDING' | 'PROCESSED' | 'FAILED' | 'ROLLED_BACK'
  metadata: text('metadata'), // JSON storing createdEmployeeIds, errors, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const importRows = pgTable('import_rows', {
  id: text('id').primaryKey(),
  importId: text('import_id')
    .notNull()
    .references(() => imports.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  employeeCode: text('employee_code'),
  fullName: text('full_name'),
  email: text('email'),
  department: text('department'),
  shiftCode: text('shift_code'),
  status: text('status').notNull(), // 'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'FAILED'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
