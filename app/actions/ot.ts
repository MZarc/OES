'use server';

import { db } from '@/db/client';
import { otRecords, shifts, holidays, otRules, employeeProfiles } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { calculateOT } from '@/domain/ot/calculator';
import { detectShiftFromStartTime } from '@/domain/ot/rules';
import { logAuditEvent } from '@/lib/audit';
import { getCurrentSession, requireAuth, requireAdmin } from '@/lib/auth/session';
import { z } from 'zod';
import crypto from 'crypto';

const SubmitOTSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time (HH:mm)'),
  shiftId: z.string().optional(),
});

export async function calculateOTPreviewAction(input: {
  workDate: string;
  startTime: string;
  endTime: string;
  shiftId?: string;
}) {
  const allShifts = await db.query.shifts.findMany();
  const shiftCandidates = allShifts.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    regularOtStartTime: s.regularOtStartTime,
    crossesMidnight: s.crossesMidnight,
    version: s.version,
  }));

  let targetShift;
  if (input.shiftId && input.shiftId !== 'auto') {
    targetShift = shiftCandidates.find((s) => s.id === input.shiftId);
  }

  // PRD: Shift is not mandatory; timing dynamically detects the applicable shift policy
  if (!targetShift) {
    targetShift = detectShiftFromStartTime(input.startTime, shiftCandidates);
  }

  const activeHolidays = await db.query.holidays.findMany({ where: eq(holidays.active, true) });
  const currentRule = await db.query.otRules.findFirst({ where: eq(otRules.isCurrent, true) });

  const result = calculateOT({
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime,
    shift: targetShift,
    holidays: activeHolidays.map((h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type,
      active: h.active,
    })),
    ruleConfig: {
      version: currentRule?.version || '2026-v1',
      weekdayMultiplier: currentRule?.weekdayMultiplier ?? 1.0,
      sundayMultiplier: currentRule?.sundayMultiplier ?? 1.25,
      holidayMultiplier: currentRule?.holidayMultiplier ?? 1.25,
      roundingPolicy: (currentRule?.roundingPolicy as any) || 'UP_TO_NEXT_1_HOUR',
    },
  });

  return {
    ...result,
    detectedShift: {
      id: targetShift.id,
      name: targetShift.name,
      code: targetShift.code,
      startTime: targetShift.startTime,
      endTime: targetShift.endTime,
      regularOtStartTime: targetShift.regularOtStartTime,
    },
  };
}

export async function submitOTAction(formData: {
  workDate: string;
  startTime: string;
  endTime: string;
  shiftId?: string;
}) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    throw new Error('No employee profile associated with this account.');
  }

  const validated = SubmitOTSchema.parse(formData);

  const allShifts = await db.query.shifts.findMany();
  const shiftCandidates = allShifts.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    regularOtStartTime: s.regularOtStartTime,
    crossesMidnight: s.crossesMidnight,
    version: s.version,
  }));

  let targetShift;
  if (validated.shiftId && validated.shiftId !== 'auto') {
    targetShift = shiftCandidates.find((s) => s.id === validated.shiftId);
  }

  // Dynamic timing detection (shifts are not locked or mandatory)
  if (!targetShift) {
    targetShift = detectShiftFromStartTime(validated.startTime, shiftCandidates);
  }

  const activeHolidays = await db.query.holidays.findMany({ where: eq(holidays.active, true) });
  const currentRule = await db.query.otRules.findFirst({ where: eq(otRules.isCurrent, true) });

  const calc = calculateOT({
    employeeId: ctx.employee.id,
    workDate: validated.workDate,
    startTime: validated.startTime,
    endTime: validated.endTime,
    shift: targetShift,
    holidays: activeHolidays.map((h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type,
      active: h.active,
    })),
    ruleConfig: {
      version: currentRule?.version || '2026-v1',
      weekdayMultiplier: currentRule?.weekdayMultiplier ?? 1.0,
      sundayMultiplier: currentRule?.sundayMultiplier ?? 1.25,
      holidayMultiplier: currentRule?.holidayMultiplier ?? 1.25,
      roundingPolicy: (currentRule?.roundingPolicy as any) || 'UP_TO_NEXT_1_HOUR',
    },
  });

  const otRecordId = `ot_${crypto.randomUUID()}`;

  await db.insert(otRecords).values({
    id: otRecordId,
    employeeId: ctx.employee.id,
    workDate: validated.workDate,
    startTime: validated.startTime,
    endTime: validated.endTime,
    shiftId: targetShift.id,
    shiftVersion: targetShift.version,
    ruleVersion: calc.ruleVersion,
    rawHours: calc.rawHours,
    multiplier: calc.multiplier,
    payableHours: calc.payableHours,
    isSunday: calc.isSunday,
    isHoliday: calc.isHoliday,
    holidayName: calc.holidayName,
    calculationSnapshot: JSON.stringify(calc.snapshot),
    status: 'SUBMITTED',
  });

  await logAuditEvent({
    actorUserId: ctx.user.id,
    action: 'OT_SUBMITTED',
    entityType: 'OT_RECORD',
    entityId: otRecordId,
    afterData: calc.snapshot,
  });

  return { success: true, otRecordId, payableHours: calc.payableHours };
}

export async function getMyOTRecordsAction() {
  const ctx = await requireAuth();
  if (!ctx.employee) return [];

  const records = await db.query.otRecords.findMany({
    where: eq(otRecords.employeeId, ctx.employee.id),
    orderBy: [desc(otRecords.submittedAt)],
  });

  return records;
}

export async function getMyOTRecordsPaginatedAction(params?: {
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

  const conditions = [eq(otRecords.employeeId, ctx.employee.id)];
  if (params?.status && params.status !== 'ALL') {
    conditions.push(eq(otRecords.status, params.status));
  }
  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${otRecords.workDate} ILIKE ${term} OR ${otRecords.status} ILIKE ${term} OR ${otRecords.holidayName} ILIKE ${term})`
    );
  }

  const whereClause = and(...conditions);

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otRecords)
    .where(whereClause);

  const total = totalCountResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  let orderByClause = desc(otRecords.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'workDate') {
    orderByClause = isAsc ? asc(otRecords.workDate) : desc(otRecords.workDate);
  } else if (params?.sortBy === 'payableHours') {
    orderByClause = isAsc ? asc(otRecords.payableHours) : desc(otRecords.payableHours);
  } else if (params?.sortBy === 'submittedAt') {
    orderByClause = isAsc ? asc(otRecords.submittedAt) : desc(otRecords.submittedAt);
  }

  const records = await db.query.otRecords.findMany({
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

export async function getAdminPendingOTAction() {
  const ctx = await requireAdmin();
  const isDemo = ctx.user.email === 'demo@oes.com';

  const conditions = [eq(otRecords.status, 'SUBMITTED')];
  if (isDemo && ctx.session?.id) {
    conditions.push(sql`${employeeProfiles.id} LIKE ${'%' + ctx.session.id}`);
  } else if (!isDemo) {
    conditions.push(sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`);
  }

  const records = await db
    .select({
      id: otRecords.id,
      workDate: otRecords.workDate,
      startTime: otRecords.startTime,
      endTime: otRecords.endTime,
      rawHours: otRecords.rawHours,
      multiplier: otRecords.multiplier,
      payableHours: otRecords.payableHours,
      isSunday: otRecords.isSunday,
      isHoliday: otRecords.isHoliday,
      holidayName: otRecords.holidayName,
      status: otRecords.status,
      submittedAt: otRecords.submittedAt,
      snapshot: otRecords.calculationSnapshot,
      rejectionReason: otRecords.rejectionReason,
      employeeName: employeeProfiles.fullName,
      employeeCode: employeeProfiles.employeeCode,
      department: employeeProfiles.department,
      shiftName: shifts.name,
    })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .innerJoin(shifts, eq(otRecords.shiftId, shifts.id))
    .where(and(...conditions))
    .orderBy(desc(otRecords.submittedAt));

  return records;
}

export async function getAdminOTPaginatedAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
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
    conditions.push(eq(otRecords.status, params.status));
  }

  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${employeeProfiles.fullName} ILIKE ${term} OR ${employeeProfiles.employeeCode} ILIKE ${term})`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .where(whereClause);

  const total = totalCountResult?.count || 0;
  const totalPages = Math.ceil(total / limit);

  let orderByClause = desc(otRecords.submittedAt);
  const isAsc = params?.sortOrder === 'asc';
  if (params?.sortBy === 'workDate') {
    orderByClause = isAsc ? asc(otRecords.workDate) : desc(otRecords.workDate);
  } else if (params?.sortBy === 'payableHours') {
    orderByClause = isAsc ? asc(otRecords.payableHours) : desc(otRecords.payableHours);
  } else if (params?.sortBy === 'fullName') {
    orderByClause = isAsc ? asc(employeeProfiles.fullName) : desc(employeeProfiles.fullName);
  } else if (params?.sortBy === 'submittedAt') {
    orderByClause = isAsc ? asc(otRecords.submittedAt) : desc(otRecords.submittedAt);
  }

  const records = await db
    .select({
      id: otRecords.id,
      workDate: otRecords.workDate,
      startTime: otRecords.startTime,
      endTime: otRecords.endTime,
      rawHours: otRecords.rawHours,
      multiplier: otRecords.multiplier,
      payableHours: otRecords.payableHours,
      isSunday: otRecords.isSunday,
      isHoliday: otRecords.isHoliday,
      holidayName: otRecords.holidayName,
      status: otRecords.status,
      submittedAt: otRecords.submittedAt,
      reviewedAt: otRecords.reviewedAt,
      snapshot: otRecords.calculationSnapshot,
      rejectionReason: otRecords.rejectionReason,
      employeeName: employeeProfiles.fullName,
      employeeCode: employeeProfiles.employeeCode,
      department: employeeProfiles.department,
      shiftName: shifts.name,
    })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .innerJoin(shifts, eq(otRecords.shiftId, shifts.id))
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

export async function approveOTAction(recordId: string) {
  const admin = await requireAdmin();

  // Optimistic concurrency safety (PRD Section 50): only update if SUBMITTED or UNDER_REVIEW
  const updated = await db
    .update(otRecords)
    .set({
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: admin.user.id,
    })
    .where(and(eq(otRecords.id, recordId), eq(otRecords.status, 'SUBMITTED')))
    .returning();

  if (updated.length === 0) {
    throw new Error('Record has already been processed or status is no longer SUBMITTED.');
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'OT_APPROVED',
    entityType: 'OT_RECORD',
    entityId: recordId,
    afterData: { status: 'APPROVED', approvedBy: admin.user.id },
  });

  return { success: true };
}

export async function rejectOTAction(recordId: string, reason: string) {
  const admin = await requireAdmin();
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is mandatory.');
  }

  const updated = await db
    .update(otRecords)
    .set({
      status: 'REJECTED',
      rejectionReason: reason.trim(),
      reviewedAt: new Date(),
      reviewedBy: admin.user.id,
    })
    .where(and(eq(otRecords.id, recordId), eq(otRecords.status, 'SUBMITTED')))
    .returning();

  if (updated.length === 0) {
    throw new Error('Record has already been processed.');
  }

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'OT_REJECTED',
    entityType: 'OT_RECORD',
    entityId: recordId,
    afterData: { status: 'REJECTED', reason: reason.trim() },
  });

  return { success: true };
}

export async function undoOTAction(recordId: string) {
  const admin = await requireAdmin();

  const [existing] = await db
    .select()
    .from(otRecords)
    .where(eq(otRecords.id, recordId));

  if (!existing) {
    throw new Error('OT Record not found.');
  }

  if (existing.status !== 'APPROVED' && existing.status !== 'REJECTED') {
    throw new Error('Only approved or rejected records can be reverted to submitted status.');
  }

  const prevStatus = existing.status;

  await db
    .update(otRecords)
    .set({
      status: 'SUBMITTED',
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(otRecords.id, recordId));

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'OT_STATUS_REVERTED',
    entityType: 'OT_RECORD',
    entityId: recordId,
    beforeData: { status: prevStatus },
    afterData: { status: 'SUBMITTED', revertedBy: admin.user.id },
  });

  return { success: true };
}

export async function deleteMyOTAction(recordId: string) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    throw new Error('No employee profile associated with this account.');
  }

  const [existing] = await db
    .select()
    .from(otRecords)
    .where(and(eq(otRecords.id, recordId), eq(otRecords.employeeId, ctx.employee.id)));

  if (!existing) {
    throw new Error('OT Record not found or does not belong to you.');
  }

  if (existing.status === 'APPROVED') {
    throw new Error('Approved records cannot be deleted. Contact your administrator for assistance.');
  }

  await db
    .delete(otRecords)
    .where(and(eq(otRecords.id, recordId), eq(otRecords.employeeId, ctx.employee.id)));

  await logAuditEvent({
    actorUserId: ctx.user.id,
    action: 'OT_DELETED_BY_EMPLOYEE',
    entityType: 'OT_RECORD',
    entityId: recordId,
    beforeData: {
      workDate: existing.workDate,
      hours: existing.payableHours,
      status: existing.status,
    },
  });

  return { success: true };
}
