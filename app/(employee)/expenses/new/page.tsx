import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { ExpenseForm } from '@/components/expense/ExpenseForm';

export default async function NewExpensePage() {
  const session = await getCurrentSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'EMPLOYEE'}
        userName={session?.user?.name || 'Employee'}
        employeeCode={session?.employee?.employeeCode}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <ExpenseForm />
      </main>
    </div>
  );
}
