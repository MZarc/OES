import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/db/client';
import { employeeProfiles, otRecords, expenses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isDemoEmail } from '@/lib/auth/demo-sandbox';
import { Navbar } from '@/components/shared/Navbar';
import Link from 'next/link';
import { Users, Clock, Receipt, FileText, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const session = await getCurrentSession();
  const userName = session?.user?.name || 'Administrator';
  const currentMonth = new Date().toISOString().substring(0, 7);
  const isDemo = isDemoEmail(session?.user?.email);
  const sessionId = session?.session?.id;

  // High-performance SQL aggregates for heavy datasets (PRD Section 27)
  const demoExcludeEmp = sql`"id" NOT LIKE 'emp_demo_%' AND "id" NOT LIKE 'emp_001_%' AND "id" NOT LIKE 'emp_002_%' AND "id" NOT LIKE 'emp_003_%'`;
  const demoScopeEmp = sessionId ? sql`"id" LIKE ${'%_' + sessionId}` : sql`1=0`;

  const [empCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeeProfiles)
    .where(isDemo ? demoScopeEmp : demoExcludeEmp);

  const demoExcludeOt = sql`"employee_id" NOT LIKE 'emp_demo_%' AND "employee_id" NOT LIKE 'emp_001_%' AND "employee_id" NOT LIKE 'emp_002_%' AND "employee_id" NOT LIKE 'emp_003_%'`;
  const demoScopeOt = sessionId ? sql`"employee_id" LIKE ${'%_' + sessionId}` : sql`1=0`;

  const [pendingOt] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otRecords)
    .where(sql`${otRecords.status} = 'SUBMITTED' AND (${isDemo ? demoScopeOt : demoExcludeOt})`);

  const demoExcludeExp = sql`"employee_id" NOT LIKE 'emp_demo_%' AND "employee_id" NOT LIKE 'emp_001_%' AND "employee_id" NOT LIKE 'emp_002_%' AND "employee_id" NOT LIKE 'emp_003_%'`;
  const demoScopeExp = sessionId ? sql`"employee_id" LIKE ${'%_' + sessionId}` : sql`1=0`;

  const [pendingExp] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .where(sql`${expenses.status} = 'SUBMITTED' AND (${isDemo ? demoScopeExp : demoExcludeExp})`);

  const [monthOt] = await db
    .select({
      sum: sql<number>`COALESCE(sum(payable_hours), 0)::float`,
    })
    .from(otRecords)
    .where(
      sql`${otRecords.status} = 'APPROVED' AND ${otRecords.workDate} LIKE ${currentMonth + '%'} AND (${isDemo ? demoScopeOt : demoExcludeOt})`
    );

  const [monthExp] = await db
    .select({
      sum: sql<number>`COALESCE(sum(amount), 0)::float`,
    })
    .from(expenses)
    .where(
      sql`${expenses.status} = 'APPROVED' AND ${expenses.expenseDate} LIKE ${currentMonth + '%'} AND (${isDemo ? demoScopeExp : demoExcludeExp})`
    );

  const totalEmployees = empCount?.count || 0;
  const pendingOtCount = pendingOt?.count || 0;
  const pendingExpensesCount = pendingExp?.count || 0;
  const thisMonthOtHours = monthOt?.sum || 0;
  const thisMonthExpenseAmount = monthExp?.sum || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={userName}
        employeeCode="ADM001"
        userEmail={session?.user?.email}
      />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Admin Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Administrative Control Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic OT Engine • Policy Versioning • Append-only Audit
          </p>
        </div>

        {/* Core KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              Employees
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {totalEmployees}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Master roster</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending OT
            </div>
            <div className="text-2xl font-extrabold text-amber-700 font-mono">
              {pendingOtCount}
            </div>
            <Link href="/admin/ot" className="text-[11px] text-blue-600 hover:underline mt-1 block">
              Review queue →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              <Receipt className="h-4 w-4 text-amber-600" />
              Pending Expenses
            </div>
            <div className="text-2xl font-extrabold text-amber-700 font-mono">
              {pendingExpensesCount}
            </div>
            <Link href="/admin/expenses" className="text-[11px] text-blue-600 hover:underline mt-1 block">
              Review queue →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              This Month OT
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {thisMonthOtHours.toFixed(1)} <span className="text-xs text-slate-500 font-normal">hrs</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Approved total</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              This Month Exp.
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {formatCurrency(thisMonthExpenseAmount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Approved total</div>
          </div>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/ot"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 transition-colors group"
          >
            <Clock className="h-6 w-6 text-blue-600 mb-2 group-hover:scale-105 transition-transform" />
            <h3 className="font-bold text-slate-900 text-sm">Review & Approve OT</h3>
            <p className="text-xs text-slate-500 mt-1">
              Inspect calculations, Sunday/holiday multipliers, and approve employee submissions.
            </p>
          </Link>

          <Link
            href="/admin/expenses"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 transition-colors group"
          >
            <Receipt className="h-6 w-6 text-emerald-600 mb-2 group-hover:scale-105 transition-transform" />
            <h3 className="font-bold text-slate-900 text-sm">Review Expenses</h3>
            <p className="text-xs text-slate-500 mt-1">
              Audit receipts, check deterministic duplicate alerts, and approve claims.
            </p>
          </Link>

          <Link
            href="/admin/reports"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-purple-500 transition-colors group"
          >
            <FileText className="h-6 w-6 text-purple-600 mb-2 group-hover:scale-105 transition-transform" />
            <h3 className="font-bold text-slate-900 text-sm">Monthly Summaries & Export</h3>
            <p className="text-xs text-slate-500 mt-1">
              Generate employee payroll OT hours and expense totals with CSV/Excel exports.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
