import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { ExpenseHistoryView } from '@/components/expenses/ExpenseHistoryView';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default async function ExpenseHistoryPage() {
  const session = await getCurrentSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'EMPLOYEE'}
        userName={session?.user?.name || 'Employee'}
        employeeCode={session?.employee?.employeeCode}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Expense Claims
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and track your reimbursement claims, approval statuses, and duplicate alerts.
            </p>
          </div>
          <Link
            href="/expenses/new"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            Submit New Expense
          </Link>
        </div>

        <ExpenseHistoryView />
      </main>
    </div>
  );
}
