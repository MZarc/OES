import { pgTable, text, timestamp, boolean, real, integer } from 'drizzle-orm/pg-core';
import { employeeProfiles } from './employees';
import { users } from './auth';

export const expenseCategories = pgTable('expense_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. 'Travel', 'Food', etc.
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employeeProfiles.id, { onDelete: 'cascade' }),
  expenseDate: text('expense_date').notNull(), // "YYYY-MM-DD"
  categoryId: text('category_id').references(() => expenseCategories.id),
  categoryName: text('category_name').notNull(),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  status: text('status').default('SUBMITTED').notNull(), // 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION'
  isFlaggedDuplicate: boolean('is_flagged_duplicate').default(false).notNull(),
  duplicateReason: text('duplicate_reason'),
  rejectionReason: text('rejection_reason'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const expenseAttachments = pgTable('expense_attachments', {
  id: text('id').primaryKey(),
  expenseId: text('expense_id')
    .notNull()
    .references(() => expenses.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  sha256Hash: text('sha256_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
