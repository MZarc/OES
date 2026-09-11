'use server';

import { db } from '@/db/client';
import { expenses, expenseAttachments, expenseCategories, employeeProfiles } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { checkDuplicateExpense } from '@/domain/expense/duplicates';
import {
  validateAttachmentConstraints,
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/domain/expense/rules';
import { uploadAttachment, getSignedDownloadUrl } from '@/lib/storage';
import { logAuditEvent } from '@/lib/audit';
import { getCurrentSession, requireAuth, requireAdmin } from '@/lib/auth/session';
import { z } from 'zod';
import crypto from 'crypto';

const SubmitExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  category: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
});

export async function submitExpenseAction(formData: FormData) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    throw new Error('No employee profile associated with this account.');
  }

  const raw = {
    expenseDate: formData.get('expenseDate') as string,
    category: formData.get('category') as string,
    amount: formData.get('amount'),
    description: formData.get('description') as string,
  };

  const validated = SubmitExpenseSchema.parse(raw);

  // Fetch recent employee expenses to run deterministic duplicate detection (PRD Section 25)
  const existingExpenses = await db.query.expenses.findMany({
    where: eq(expenses.employeeId, ctx.employee.id),
    orderBy: [desc(expenses.expenseDate)],
    limit: 50,
  });

  const dupCheck = checkDuplicateExpense({
    employeeId: ctx.employee.id,
    expenseDate: validated.expenseDate,
    category: validated.category as any,
    amount: validated.amount,
    description: validated.description,
    existingExpenses: existingExpenses.map((e) => ({
      id: e.id,
      expenseDate: e.expenseDate,
      category: e.categoryName,
      amount: e.amount,
      description: e.description,
      status: e.status,
    })),
  });

  const expenseId = `exp_${crypto.randomUUID()}`;

  // Insert expense record
  await db.insert(expenses).values({
    id: expenseId,
    employeeId: ctx.employee.id,
    expenseDate: validated.expenseDate,
    categoryName: validated.category,
    amount: validated.amount,
    description: validated.description,
    status: 'SUBMITTED',
    isFlaggedDuplicate: dupCheck.isPossibleDuplicate,
    duplicateReason: dupCheck.flagReason || null,
  });

  // Handle file uploads
  const files = formData.getAll('attachments') as File[];
  const validFiles = files.filter((f) => f && f.size > 0);

  if (validFiles.length > 0) {
    const fileMeta = validFiles.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    const constraintCheck = validateAttachmentConstraints(fileMeta);
    if (!constraintCheck.valid) {
      throw new Error(constraintCheck.error);
    }

    for (const file of validFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await uploadAttachment(buffer, file.name, file.type || 'image/jpeg');

      await db.insert(expenseAttachments).values({
        id: `att_${crypto.randomUUID()}`,
        expenseId,
        storageKey: uploadResult.storageKey,
        originalFilename: file.name,
        mimeType: uploadResult.mimeType,
        fileSizeBytes: uploadResult.fileSizeBytes,
        sha256Hash: uploadResult.sha256Hash,
      });
    }
  }

  await logAuditEvent({
    actorUserId: ctx.user.id,
    action: 'EXPENSE_SUBMITTED',
    entityType: 'EXPENSE',
    entityId: expenseId,
    afterData: {
      amount: validated.amount,
      category: validated.category,
      date: validated.expenseDate,
      duplicateWarning: dupCheck.flagReason,
    },
  });

  return {
    success: true,
    expenseId,
    isFlaggedDuplicate: dupCheck.isPossibleDuplicate,
    duplicateReason: dupCheck.flagReason,
  };
}

export async function getMyExpensesAction() {
  const ctx = await requireAuth();
  if (!ctx.employee) return [];

  const items = await db.query.expenses.findMany({
    where: eq(expenses.employeeId, ctx.employee.id),
    orderBy: [desc(expenses.submittedAt)],
  });

  return items;
}

export async function getMyExpensesPaginatedAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const ctx = await requireAuth();
  if (!ctx.employee) return { records: [], total: 0, page: 1, totalPages: 0, limit: 15 };

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 15));
  const offset = (page - 1) * limit;

  const conditions = [eq(expenses.employeeId, ctx.employee.id)];
  if (params?.status && params.status !== 'ALL') {
    conditions.push(eq(expenses.status, params.status));
  }
  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${expenses.categoryName} ILIKE ${term} OR ${expenses.description} ILIKE ${term} OR ${expenses.status} ILIKE ${term})`
    );
  }

  const whereClause = and(...conditions);

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .where(whereClause);

  const total = totalCountResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  let orderByClause = desc(expenses.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'expenseDate') {
    orderByClause = isAsc ? asc(expenses.expenseDate) : desc(expenses.expenseDate);
  } else if (params?.sortBy === 'amount') {
    orderByClause = isAsc ? asc(expenses.amount) : desc(expenses.amount);
  } else if (params?.sortBy === 'submittedAt') {
    orderByClause = isAsc ? asc(expenses.submittedAt) : desc(expenses.submittedAt);
  }

  const records = await db.query.expenses.findMany({
    where: whereClause,
    orderBy: [orderByClause],
    limit,
    offset,
  });

  return {
    records,
    total,
    page,
    totalPages,
    limit,
  };
}

export async function getAdminPendingExpensesAction() {
  const ctx = await requireAdmin();
  const isDemo = ctx.user.email === 'demo@oes.com';

  const conditions = [eq(expenses.status, 'SUBMITTED')];
  if (isDemo && ctx.session?.id) {
    conditions.push(sql`${employeeProfiles.id} LIKE ${'%' + ctx.session.id}`);
  } else if (!isDemo) {
    conditions.push(sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`);
  }

  const records = await db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      categoryName: expenses.categoryName,
      amount: expenses.amount,
      description: expenses.description,
      status: expenses.status,
      isFlaggedDuplicate: expenses.isFlaggedDuplicate,
      duplicateReason: expenses.duplicateReason,
      rejectionReason: expenses.rejectionReason,
      submittedAt: expenses.submittedAt,
      employeeName: employeeProfiles.fullName,
      employeeCode: employeeProfiles.employeeCode,
      department: employeeProfiles.department,
    })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.submittedAt));

  return records;
}

export async function getAdminExpensesPaginatedAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const ctx = await requireAdmin();
  const isDemo = ctx.user.email === 'demo@oes.com';

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 15));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (isDemo && ctx.session?.id) {
    conditions.push(sql`${employeeProfiles.id} LIKE ${'%' + ctx.session.id}`);
  } else if (!isDemo) {
    conditions.push(sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`);
  }

  if (params?.status && params.status !== 'ALL') {
    conditions.push(eq(expenses.status, params.status));
  }
  if (params?.category && params.category !== 'ALL') {
    conditions.push(eq(expenses.categoryName, params.category));
  }
  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${employeeProfiles.fullName} ILIKE ${term} OR ${employeeProfiles.employeeCode} ILIKE ${term} OR ${expenses.description} ILIKE ${term})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(whereClause);

  const total = totalCountResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  let orderByClause = desc(expenses.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'expenseDate') {
    orderByClause = isAsc ? asc(expenses.expenseDate) : desc(expenses.expenseDate);
  } else if (params?.sortBy === 'amount') {
    orderByClause = isAsc ? asc(expenses.amount) : desc(expenses.amount);
  } else if (params?.sortBy === 'fullName') {
    orderByClause = isAsc ? asc(employeeProfiles.fullName) : desc(employeeProfiles.fullName);
  } else if (params?.sortBy === 'submittedAt') {
    orderByClause = isAsc ? asc(expenses.submittedAt) : desc(expenses.submittedAt);
  }

  const records = await db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      categoryName: expenses.categoryName,
      amount: expenses.amount,
      description: expenses.description,
      status: expenses.status,
      isFlaggedDuplicate: expenses.isFlaggedDuplicate,
      duplicateReason: expenses.duplicateReason,
      rejectionReason: expenses.rejectionReason,
      submittedAt: expenses.submittedAt,
      reviewedAt: expenses.reviewedAt,
      employeeName: employeeProfiles.fullName,
      employeeCode: employeeProfiles.employeeCode,
      department: employeeProfiles.department,
    })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return {
    records,
    total,
    page,
    totalPages,
    limit,
  };
}

export async function approveExpenseAction(expenseId: string) {
  const admin = await requireAdmin();

  const updated = await db
    .update(expenses)
    .set({
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: admin.user.id,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.status, 'SUBMITTED')))
    .returning();

  if (updated.length === 0) {
    throw new Error('Expense already processed or status is not SUBMITTED.');
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EXPENSE_APPROVED',
    entityType: 'EXPENSE',
    entityId: expenseId,
    afterData: { status: 'APPROVED', approvedBy: admin.user.id },
  });

  return { success: true };
}

export async function rejectExpenseAction(expenseId: string, reason: string) {
  const admin = await requireAdmin();
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is mandatory.');
  }

  const updated = await db
    .update(expenses)
    .set({
      status: 'REJECTED',
      rejectionReason: reason.trim(),
      reviewedAt: new Date(),
      reviewedBy: admin.user.id,
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.status, 'SUBMITTED')))
    .returning();

  if (updated.length === 0) {
    throw new Error('Expense already processed.');
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EXPENSE_REJECTED',
    entityType: 'EXPENSE',
    entityId: expenseId,
    afterData: { status: 'REJECTED', reason: reason.trim() },
  });

  return { success: true };
}

export async function undoExpenseAction(expenseId: string) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId));

  if (!existing) {
    throw new Error('Expense claim not found.');
  }

  if (existing.status !== 'APPROVED' && existing.status !== 'REJECTED') {
    throw new Error('Only approved or rejected expenses can be reverted to submitted status.');
  }

  const prevStatus = existing.status;

  await db
    .update(expenses)
    .set({
      status: 'SUBMITTED',
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId));

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EXPENSE_STATUS_REVERTED',
    entityType: 'EXPENSE',
    entityId: expenseId,
    beforeData: { status: prevStatus },
    afterData: { status: 'SUBMITTED', revertedBy: admin.user.id },
  });

  return { success: true };
}

export async function deleteMyExpenseAction(expenseId: string) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    throw new Error('No employee profile associated with this account.');
  }

  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.employeeId, ctx.employee.id)));

  if (!existing) {
    throw new Error('Expense claim not found or does not belong to you.');
  }

  if (existing.status === 'APPROVED') {
    throw new Error('Approved expenses cannot be deleted. Contact your administrator for assistance.');
  }

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.employeeId, ctx.employee.id)));

  await logAuditEvent({
    actorUserId: ctx.user.id,
    action: 'EXPENSE_DELETED_BY_EMPLOYEE',
    entityType: 'EXPENSE',
    entityId: expenseId,
    beforeData: {
      expenseDate: existing.expenseDate,
      amount: existing.amount,
      categoryName: existing.categoryName,
      status: existing.status,
    },
  });

  return { success: true };
}

export async function getExpenseAttachmentsAction(expenseId: string) {
  try {
    await requireAuth();

    const atts = await db
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseId, expenseId));

    const items = await Promise.all(
      atts.map(async (a) => {
        let downloadUrl = '';
        if (a.storageKey) {
          try {
            downloadUrl = await getSignedDownloadUrl(a.storageKey, 3600);
          } catch (e) {
            console.warn(`Failed to generate signed URL for ${a.storageKey}:`, e);
          }
        }
        return {
          id: a.id,
          filename: a.originalFilename,
          mimeType: a.mimeType,
          sizeBytes: a.fileSizeBytes,
          storageKey: a.storageKey,
          url: downloadUrl,
        };
      })
    );

    return items;
  } catch (error) {
    console.error(`[Attachment Fetch Error] Failed to fetch attachments for claim ${expenseId}:`, error);
    return [];
  }
}
