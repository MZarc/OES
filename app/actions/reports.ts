'use server';

import { db } from '@/db/client';
import { otRecords, expenses, employeeProfiles, shifts } from '@/db/schema';
import { eq, and, sql, not, gte, lte, desc, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';

export interface MonthlyEmployeeSummary {
  employeeCode: string;
  fullName: string;
  department: string | null;
  shiftName: string;
  totalOtHours: number;
  totalApprovedExpenses: number;
  pendingOtCount: number;
  pendingExpenseCount: number;
}

export interface ReportsSummaryResult {
  fromDate: string;
  toDate: string;
  summaries: MonthlyEmployeeSummary[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  grandTotalOtHours: number;
  grandTotalExpenses: number;
  activeStaffCount: number;
}

export interface MonthlyReportsResult {
  month: string;
  summaries: MonthlyEmployeeSummary[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  grandTotalOtHours: number;
  grandTotalExpenses: number;
}

export async function getReportsSummaryAction(params?: {
  fromDate?: string;
  toDate?: string;
  monthPrefix?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onlyActiveUsers?: boolean;
}): Promise<ReportsSummaryResult> {
  await requireAdmin();

  // Determine date bounds
  let fromDate = params?.fromDate;
  let toDate = params?.toDate;

  if (!fromDate || !toDate) {
    const month = params?.monthPrefix || new Date().toISOString().substring(0, 7);
    fromDate = `${month}-01`;
    // Last day of month
    const [year, m] = month.split('-').map(Number);
    const lastDay = new Date(year, m, 0).getDate();
    toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  }

  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 15));

  const allEmployees = await db
    .select({
      id: employeeProfiles.id,
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      department: employeeProfiles.department,
      shiftName: shifts.name,
      status: employeeProfiles.status,
    })
    .from(employeeProfiles)
    .innerJoin(shifts, eq(employeeProfiles.shiftId, shifts.id))
    .where(and(
      not(eq(employeeProfiles.status, 'DELETED')),
      sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`
    ));

  const search = params?.search?.toLowerCase().trim();
  const searchedEmployees = search
    ? allEmployees.filter(
        (e) =>
          e.employeeCode.toLowerCase().includes(search) ||
          e.fullName.toLowerCase().includes(search) ||
          (e.department && e.department.toLowerCase().includes(search))
      )
    : allEmployees;

  const summaries: MonthlyEmployeeSummary[] = [];
  let grandTotalOtHours = 0;
  let grandTotalExpenses = 0;

  const empIds = searchedEmployees.map((e) => e.id);
  const otByEmployee = new Map<string, { approvedHours: number; pendingCount: number }>();
  const expByEmployee = new Map<string, { approvedAmount: number; pendingCount: number }>();

  if (empIds.length > 0) {
    const allOt = await db
      .select({
        employeeId: otRecords.employeeId,
        payableHours: otRecords.payableHours,
        status: otRecords.status,
      })
      .from(otRecords)
      .where(
        and(
          inArray(otRecords.employeeId, empIds),
          gte(otRecords.workDate, fromDate),
          lte(otRecords.workDate, toDate)
        )
      );

    for (const o of allOt) {
      const existing = otByEmployee.get(o.employeeId) || { approvedHours: 0, pendingCount: 0 };
      if (o.status === 'APPROVED') {
        existing.approvedHours += o.payableHours;
      } else if (o.status === 'SUBMITTED') {
        existing.pendingCount += 1;
      }
      otByEmployee.set(o.employeeId, existing);
    }

    const allExp = await db
      .select({
        employeeId: expenses.employeeId,
        amount: expenses.amount,
        status: expenses.status,
      })
      .from(expenses)
      .where(
        and(
          inArray(expenses.employeeId, empIds),
          gte(expenses.expenseDate, fromDate),
          lte(expenses.expenseDate, toDate)
        )
      );

    for (const e of allExp) {
      const existing = expByEmployee.get(e.employeeId) || { approvedAmount: 0, pendingCount: 0 };
      if (e.status === 'APPROVED') {
        existing.approvedAmount += e.amount;
      } else if (e.status === 'SUBMITTED') {
        existing.pendingCount += 1;
      }
      expByEmployee.set(e.employeeId, existing);
    }
  }

  for (const emp of searchedEmployees) {
    const otData = otByEmployee.get(emp.id) || { approvedHours: 0, pendingCount: 0 };
    const expData = expByEmployee.get(emp.id) || { approvedAmount: 0, pendingCount: 0 };

    const roundedOt = Math.round(otData.approvedHours * 100) / 100;
    const roundedExp = Math.round(expData.approvedAmount * 100) / 100;

    // User requirement: Keep only users which have recorded OT or Expense only. Not all users.
    const hasActivity = roundedOt > 0 || roundedExp > 0 || otData.pendingCount > 0 || expData.pendingCount > 0;
    const shouldInclude = params?.onlyActiveUsers === false ? true : hasActivity;

    if (shouldInclude) {
      grandTotalOtHours += roundedOt;
      grandTotalExpenses += roundedExp;

      summaries.push({
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.department,
        shiftName: emp.shiftName,
        totalOtHours: roundedOt,
        totalApprovedExpenses: roundedExp,
        pendingOtCount: otData.pendingCount,
        pendingExpenseCount: expData.pendingCount,
      });
    }
  }

  // Sort summaries
  const isAsc = params?.sortOrder === 'asc';
  summaries.sort((a, b) => {
    if (params?.sortBy === 'code') {
      return isAsc
        ? a.employeeCode.localeCompare(b.employeeCode)
        : b.employeeCode.localeCompare(a.employeeCode);
    }
    if (params?.sortBy === 'otHours') {
      return isAsc ? a.totalOtHours - b.totalOtHours : b.totalOtHours - a.totalOtHours;
    }
    if (params?.sortBy === 'expenseAmount') {
      return isAsc
        ? a.totalApprovedExpenses - b.totalApprovedExpenses
        : b.totalApprovedExpenses - a.totalApprovedExpenses;
    }
    return isAsc ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName);
  });

  const total = summaries.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const paginatedSummaries = summaries.slice(offset, offset + limit);

  return {
    fromDate,
    toDate,
    summaries: paginatedSummaries,
    total,
    page,
    totalPages,
    limit,
    grandTotalOtHours: Math.round(grandTotalOtHours * 100) / 100,
    grandTotalExpenses: Math.round(grandTotalExpenses * 100) / 100,
    activeStaffCount: total,
  };
}

// Backward compatibility wrapper for getMonthlySummaryAction
export async function getMonthlySummaryAction(
  monthPrefix?: string,
  params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
) {
  const res = await getReportsSummaryAction({ monthPrefix, ...params, onlyActiveUsers: false });
  return {
    month: monthPrefix || new Date().toISOString().substring(0, 7),
    summaries: res.summaries,
    total: res.total,
    page: res.page,
    totalPages: res.totalPages,
    limit: res.limit,
    grandTotalOtHours: res.grandTotalOtHours,
    grandTotalExpenses: res.grandTotalExpenses,
  };
}

export async function exportReportsAction(fromDate?: string, toDate?: string, search?: string) {
  await requireAdmin();
  const res = await getReportsSummaryAction({
    fromDate,
    toDate,
    search,
    limit: 1000,
    onlyActiveUsers: true,
  });
  return res.summaries;
}

export async function exportOTReportAction(fromDate?: string, toDate?: string, search?: string) {
  await requireAdmin();

  let fDate = fromDate || `${new Date().toISOString().substring(0, 7)}-01`;
  let tDate = toDate || new Date().toISOString().split('T')[0];

  const conditions = [
    gte(otRecords.workDate, fDate),
    lte(otRecords.workDate, tDate),
    not(eq(employeeProfiles.status, 'DELETED')),
    sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`,
  ];

  const list = await db
    .select({
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      department: employeeProfiles.department,
      shiftName: shifts.name,
      workDate: otRecords.workDate,
      startTime: otRecords.startTime,
      endTime: otRecords.endTime,
      payableHours: otRecords.payableHours,
      status: otRecords.status,
      submittedAt: otRecords.submittedAt,
    })
    .from(otRecords)
    .innerJoin(employeeProfiles, eq(otRecords.employeeId, employeeProfiles.id))
    .innerJoin(shifts, eq(otRecords.shiftId, shifts.id))
    .where(and(...conditions))
    .orderBy(desc(otRecords.workDate));

  if (!search || !search.trim()) return list;

  const s = search.toLowerCase().trim();
  return list.filter(
    (r) =>
      r.employeeCode.toLowerCase().includes(s) ||
      r.fullName.toLowerCase().includes(s) ||
      (r.department && r.department.toLowerCase().includes(s))
  );
}

export async function exportExpenseReportAction(fromDate?: string, toDate?: string, search?: string) {
  await requireAdmin();

  let fDate = fromDate || `${new Date().toISOString().substring(0, 7)}-01`;
  let tDate = toDate || new Date().toISOString().split('T')[0];

  const conditions = [
    gte(expenses.expenseDate, fDate),
    lte(expenses.expenseDate, tDate),
    not(eq(employeeProfiles.status, 'DELETED')),
    sql`${employeeProfiles.id} NOT LIKE 'emp_demo_%' AND ${employeeProfiles.id} NOT LIKE 'emp_001_%' AND ${employeeProfiles.id} NOT LIKE 'emp_002_%' AND ${employeeProfiles.id} NOT LIKE 'emp_003_%'`,
  ];

  const list = await db
    .select({
      employeeCode: employeeProfiles.employeeCode,
      fullName: employeeProfiles.fullName,
      department: employeeProfiles.department,
      expenseDate: expenses.expenseDate,
      categoryName: expenses.categoryName,
      amount: expenses.amount,
      description: expenses.description,
      status: expenses.status,
      submittedAt: expenses.submittedAt,
    })
    .from(expenses)
    .innerJoin(employeeProfiles, eq(expenses.employeeId, employeeProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate));

  if (!search || !search.trim()) return list;

  const s = search.toLowerCase().trim();
  return list.filter(
    (r) =>
      r.employeeCode.toLowerCase().includes(s) ||
      r.fullName.toLowerCase().includes(s) ||
      (r.department && r.department.toLowerCase().includes(s)) ||
      r.description.toLowerCase().includes(s)
  );
}
