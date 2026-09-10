import { getAdminPendingExpensesAction } from '@/app/actions/expenses';
import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { PendingExpensesTable } from '@/components/admin/PendingExpensesTable';

export default async function AdminExpensesPage() {
  const session = await getCurrentSession();
  const expenses = await getAdminPendingExpensesAction();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Expense Claim Approvals
          </h1>
          <p className="text-xs text-slate-500">
            Review submitted reimbursement claims, audit receipts, and inspect duplicate alerts
          </p>
        </div>

        <PendingExpensesTable initialExpenses={expenses as any} />
      </main>
    </div>
  );
}
