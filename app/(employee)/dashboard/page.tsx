import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/db/client';
import { otRecords, expenses } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { Navbar } from '@/components/shared/Navbar';
import Link from 'next/link';
import { Clock, Receipt, PlusCircle, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { formatCurrency, formatDateDisplay } from '@/lib/utils';

export default async function EmployeeDashboardPage() {
  const session = await getCurrentSession();
  const userName = session?.user?.name || 'Meet Mistry';
  const employeeCode = session?.employee?.employeeCode || 'EMP001';
  const employeeId = session?.employee?.id;

  // Retrieve this month's statistics
  const currentMonth = new Date().toISOString().substring(0, 7);

  // High-performance SQL aggregates for stats
  let totalOtHours = 0;
  let totalExpenseAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let recentOt: any[] = [];
  let recentExpenses: any[] = [];

  if (employeeId) {
    const [otSum] = await db
      .select({ sum: sql<number>`COALESCE(sum(payable_hours), 0)::float` })
      .from(otRecords)
      .where(
        sql`${otRecords.employeeId} = ${employeeId} AND ${otRecords.status} = 'APPROVED' AND ${otRecords.workDate} LIKE ${currentMonth + '%'}`
      );

    const [expSum] = await db
      .select({ sum: sql<number>`COALESCE(sum(amount), 0)::float` })
      .from(expenses)
      .where(
        sql`${expenses.employeeId} = ${employeeId} AND ${expenses.status} = 'APPROVED' AND ${expenses.expenseDate} LIKE ${currentMonth + '%'}`
      );

    const [pendingOt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(otRecords)
      .where(
        sql`${otRecords.employeeId} = ${employeeId} AND ${otRecords.status} = 'SUBMITTED'`
      );

    const [pendingExp] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(
        sql`${expenses.employeeId} = ${employeeId} AND ${expenses.status} = 'SUBMITTED'`
      );

    const [appOt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(otRecords)
      .where(
        sql`${otRecords.employeeId} = ${employeeId} AND ${otRecords.status} = 'APPROVED'`
      );

    const [appExp] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(
        sql`${expenses.employeeId} = ${employeeId} AND ${expenses.status} = 'APPROVED'`
      );

    totalOtHours = otSum?.sum || 0;
    totalExpenseAmount = expSum?.sum || 0;
    pendingCount = (pendingOt?.count || 0) + (pendingExp?.count || 0);
    approvedCount = (appOt?.count || 0) + (appExp?.count || 0);

    recentOt = await db.query.otRecords.findMany({
      where: eq(otRecords.employeeId, employeeId),
      orderBy: [desc(otRecords.workDate)],
      limit: 5,
    });

    recentExpenses = await db.query.expenses.findMany({
      where: eq(expenses.employeeId, employeeId),
      orderBy: [desc(expenses.expenseDate)],
      limit: 5,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'EMPLOYEE'}
        userName={userName}
        employeeCode={employeeCode}
        userEmail={session?.user?.email}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Good morning, {userName}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Employee Portal • {employeeCode} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/ot/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              Add OT
            </Link>
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              Add Expense
            </Link>
          </div>
        </div>

        {/* This Month Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Approved OT
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {totalOtHours.toFixed(2)} <span className="text-sm font-normal text-slate-500">hrs</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">This month</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Approved Expenses
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {formatCurrency(totalExpenseAmount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">This month</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Pending Review
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {pendingCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Awaiting admin review</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              Total Approvals
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {approvedCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Lifetime approvals</div>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
            <Link href="/ot/history" className="text-xs font-semibold text-blue-600 hover:underline">
              View All History →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOt.length === 0 && recentExpenses.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No recent activity. Use the buttons above to log OT or submit your first expense.
              </div>
            ) : (
              [...recentOt.map((r) => ({ ...r, itemType: 'OT' })), ...recentExpenses.map((e) => ({ ...e, itemType: 'EXPENSE' }))]
                .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                .slice(0, 6)
                .map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.itemType === 'OT' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {item.itemType === 'OT' ? <Clock className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {item.itemType === 'OT'
                            ? `Overtime: ${item.payableHours.toFixed(2)} hrs (${formatDateDisplay(item.workDate)})`
                            : `Expense: ${formatCurrency(item.amount)} (${item.categoryName}) • ${formatDateDisplay(item.expenseDate)}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.itemType === 'OT'
                            ? `${item.startTime} → ${item.endTime}`
                            : item.description}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.rejectionReason && (
                        <div className="text-[10px] text-red-600 mt-0.5 max-w-xs truncate">
                          {item.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
