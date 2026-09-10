'use server';

import { db } from '@/db/client';
import { shifts, holidays, otRules } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { calculateOT } from '@/domain/ot/calculator';
import { requireAdmin } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';
import crypto from 'crypto';

export async function simulateOTCalculationAction(input: {
  workDate: string;
  startTime: string;
  endTime: string;
  shiftId: string;
  roundingPolicy?: string;
  weekdayMultiplier?: number;
  sundayMultiplier?: number;
  holidayMultiplier?: number;
}) {
  await requireAdmin();

  const shiftRecord = await db.query.shifts.findFirst({
    where: eq(shifts.id, input.shiftId),
  });

  if (!shiftRecord) {
    throw new Error('Shift not found');
  }

  const activeHolidays = await db.query.holidays.findMany({
    where: eq(holidays.active, true),
  });

  const currentRule = await db.query.otRules.findFirst({
    where: eq(otRules.isCurrent, true),
  });

  const result = calculateOT({
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime,
    shift: {
      id: shiftRecord.id,
      code: shiftRecord.code,
      name: shiftRecord.name,
      startTime: shiftRecord.startTime,
      endTime: shiftRecord.endTime,
      regularOtStartTime: shiftRecord.regularOtStartTime,
      crossesMidnight: shiftRecord.crossesMidnight,
      version: shiftRecord.version,
    },
    holidays: activeHolidays.map((h) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type,
      active: h.active,
    })),
    ruleConfig: {
      version: 'SIMULATOR-TEMP',
      weekdayMultiplier: input.weekdayMultiplier ?? currentRule?.weekdayMultiplier ?? 1.0,
      sundayMultiplier: input.sundayMultiplier ?? currentRule?.sundayMultiplier ?? 1.25,
      holidayMultiplier: input.holidayMultiplier ?? currentRule?.holidayMultiplier ?? 1.25,
      roundingPolicy: (input.roundingPolicy as any) || (currentRule?.roundingPolicy as any) || 'UP_TO_NEXT_1_HOUR',
    },
  });

  return result;
}

export async function getShiftsAction() {
  return await db.query.shifts.findMany({
    orderBy: [desc(shifts.createdAt)],
  });
}

export async function updateShiftAction(params: {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  regularOtStartTime: string;
  crossesMidnight: boolean;
}) {
  const admin = await requireAdmin();

  const current = await db.query.shifts.findFirst({ where: eq(shifts.id, params.id) });

  const updated = await db
    .update(shifts)
    .set({
      name: params.name,
      startTime: params.startTime,
      endTime: params.endTime,
      regularOtStartTime: params.regularOtStartTime,
      crossesMidnight: params.crossesMidnight,
      version: `v-${Date.now()}`,
      updatedAt: new Date(),
    })
    .where(eq(shifts.id, params.id))
    .returning();

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'SHIFT_UPDATED',
    entityType: 'SHIFT',
    entityId: params.id,
    beforeData: current,
    afterData: updated[0],
  });

  return { success: true, shift: updated[0] };
}

export async function getHolidaysAction() {
  return await db.query.holidays.findMany({
    orderBy: [holidays.date],
  });
}

export async function createHolidayAction(params: {
  date: string;
  name: string;
  type: string;
}) {
  const admin = await requireAdmin();
  const id = `hol_${crypto.randomUUID()}`;

  await db.insert(holidays).values({
    id,
    date: params.date,
    name: params.name,
    type: params.type,
    active: true,
  });

  await logAuditEvent({
    actorUserId: admin.user.id,
    action: 'HOLIDAY_CREATED',
    entityType: 'HOLIDAY',
    entityId: id,
    afterData: params,
  });

  return { success: true, id };
}
