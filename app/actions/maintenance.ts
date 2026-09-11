'use server';

import { db } from '@/db/client';
import { otRecords, expenses, expenseAttachments, employeeProfiles, auditLogs, imports, importRows } from '@/db/schema';
import { eq, and, sql, inArray, gte, lte, desc, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { auth } from '@/lib/auth';
import { deleteAttachment } from '@/lib/storage';
import { logAuditEvent } from '@/lib/audit';

async function verifyAdminPassword(email: string, password?: string) {
  if (!password || !password.trim()) {
    throw new Error('Admin password is required to confirm this permanent hard delete action.');
  }
  try {
    const res = await auth.api.signInEmail({
      body: { email, password },
    });
    if (!res || !res.user) {
      throw new Error('Invalid admin password.');
    }
  } catch (err: any) {
    throw new Error('Admin password verification failed. Invalid credentials.');
  }
}

export async function getControlCenterOTAction(params?: {
  fromDate?: string;
  toDate?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  await requireAdmin();

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [
    sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`,
  ];

  if (params?.fromDate) {
    conditions.push(gte(otRecords.workDate, params.fromDate));
  }
  if (params?.toDate) {
    conditions.push(lte(otRecords.workDate, params.toDate));
  }
  if (params?.status && params.status !== 'ALL') {
    conditions.push(eq(otRecords.status, params.status));
  }

  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${employeeProfiles.fullName} ILIKE ${term} OR ${employeeProfiles.employeeCode} ILIKE ${term})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .where(whereClause);

  const total = countRes?.count || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  let orderByClause = desc(otRecords.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'workDate') {
    orderByClause = isAsc ? asc(otRecords.workDate) : desc(otRecords.workDate);
  } else if (params?.sortBy === 'hours') {
    orderByClause = isAsc ? asc(otRecords.payableHours) : desc(otRecords.payableHours);
  }

  const records = await db
    .select({
      id: otRecords.id,
      employeeCode: employeeProfiles.employeeCode,
      employeeName: employeeProfiles.fullName,
      workDate: otRecords.workDate,
      payableHours: otRecords.payableHours,
      status: otRecords.status,
      createdAt: otRecords.submittedAt,
    })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  return { records, total, page, totalPages, limit };
}

export async function getControlCenterExpensesAction(params?: {
  fromDate?: string;
  toDate?: string;
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  await requireAdmin();

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [
    sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`,
  ];

  if (params?.fromDate) {
    conditions.push(gte(expenses.expenseDate, params.fromDate));
  }
  if (params?.toDate) {
    conditions.push(lte(expenses.expenseDate, params.toDate));
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

  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(whereClause);

  const total = countRes?.count || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  let orderByClause = desc(expenses.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'expenseDate') {
    orderByClause = isAsc ? asc(expenses.expenseDate) : desc(expenses.expenseDate);
  } else if (params?.sortBy === 'amount') {
    orderByClause = isAsc ? asc(expenses.amount) : desc(expenses.amount);
  }

  const rawRecords = await db
    .select({
      id: expenses.id,
      employeeCode: employeeProfiles.employeeCode,
      employeeName: employeeProfiles.fullName,
      category: expenses.categoryName,
      amount: expenses.amount,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      status: expenses.status,
      createdAt: expenses.submittedAt,
    })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  // Fetch linked attachment info
  const records = await Promise.all(
    rawRecords.map(async (r) => {
      const atts = await db
        .select()
        .from(expenseAttachments)
        .where(eq(expenseAttachments.expenseId, r.id));
      return {
        ...r,
        merchantName: r.description,
        receiptStorageKey: atts.length > 0 ? atts[0].storageKey : null,
      };
    })
  );

  return { records, total, page, totalPages, limit };
}

export async function hardDeleteOTRecordsAction(recordIds: string[], adminPassword?: string) {
  const admin = await requireAdmin();
  await verifyAdminPassword(admin.user.email, adminPassword);

  if (!recordIds || recordIds.length === 0) {
    throw new Error('No OT records selected for deletion.');
  }

  const deleted = await db
    .delete(otRecords)
    .where(inArray(otRecords.id, recordIds))
    .returning({ id: otRecords.id });

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'OT_PERMANENTLY_DELETED',
    entityType: 'OT_RECORD',
    entityId: admin.user.id,
    afterData: { count: deleted.length, recordIds },
  });

  return { success: true, count: deleted.length };
}

export async function hardDeleteExpenseRecordsAction(expenseIds: string[], adminPassword?: string) {
  const admin = await requireAdmin();
  await verifyAdminPassword(admin.user.email, adminPassword);

  if (!expenseIds || expenseIds.length === 0) {
    throw new Error('No expense records selected for deletion.');
  }

  // Fetch linked attachment storage keys
  const attachments = await db
    .select()
    .from(expenseAttachments)
    .where(inArray(expenseAttachments.expenseId, expenseIds));

  // Purge attachment files from object storage
  let purgedFilesCount = 0;
  for (const att of attachments) {
    if (att.storageKey) {
      try {
        await deleteAttachment(att.storageKey);
        purgedFilesCount++;
      } catch (err) {
        console.warn(`Failed to delete object attachment ${att.storageKey}:`, err);
      }
    }
  }

  // Delete attachment rows
  if (attachments.length > 0) {
    await db.delete(expenseAttachments).where(inArray(expenseAttachments.expenseId, expenseIds));
  }

  // Hard delete expense DB records
  const deleted = await db
    .delete(expenses)
    .where(inArray(expenses.id, expenseIds))
    .returning({ id: expenses.id });

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'EXPENSE_PERMANENTLY_DELETED',
    entityType: 'EXPENSE',
    entityId: admin.user.id,
    afterData: { count: deleted.length, purgedFilesCount, expenseIds },
  });

  return { success: true, count: deleted.length, purgedFilesCount };
}

export async function hardDeleteAllUploadedImagesAction(adminPassword?: string) {
  const admin = await requireAdmin();
  if (admin.user.email === 'demo@oes.com') {
    throw new Error('🔒 Demo Sandbox: Receipt storage purge is locked in live demo mode for security.');
  }
  await verifyAdminPassword(admin.user.email, adminPassword);

  const allAtts = await db.select().from(expenseAttachments);

  let purgedCount = 0;
  for (const att of allAtts) {
    if (att.storageKey) {
      try {
        await deleteAttachment(att.storageKey);
        purgedCount++;
      } catch (e) {}
    }
  }

  await db.delete(expenseAttachments);

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'ALL_RECEIPTS_PURGED',
    entityType: 'STORAGE',
    entityId: admin.user.id,
    afterData: { purgedCount },
  });

  return { success: true, purgedCount };
}

export async function factoryResetSystemDataAction(confirmPhrase: string, adminPassword?: string) {
  const admin = await requireAdmin();
  if (admin.user.email === 'demo@oes.com') {
    throw new Error('🔒 Demo Sandbox: System Factory Reset is locked in live demo mode for security.');
  }
  await verifyAdminPassword(admin.user.email, adminPassword);

  if (confirmPhrase.trim().toUpperCase() !== 'PERMANENT RESET') {
    throw new Error('Invalid confirmation phrase. Type "PERMANENT RESET" to proceed.');
  }

  // 1. Purge Expense Attachments & Expenses
  const allAtts = await db.select().from(expenseAttachments);
  for (const att of allAtts) {
    if (att.storageKey) {
      try {
        await deleteAttachment(att.storageKey);
      } catch (err) {}
    }
  }
  await db.delete(expenseAttachments);
  await db.delete(expenses);

  // 2. Purge OT Records
  await db.delete(otRecords);

  // 3. Purge Imports & Logs
  await db.delete(importRows);
  await db.delete(imports);
  await db.delete(auditLogs);

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'FACTORY_RESET_EXECUTED',
    entityType: 'SYSTEM',
    entityId: admin.user.id,
    afterData: { timestamp: new Date().toISOString() },
  });

  return { success: true };
}
