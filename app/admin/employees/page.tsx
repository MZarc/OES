import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { EmployeesDirectoryView } from '@/components/admin/EmployeesDirectoryView';

export default async function AdminEmployeesPage() {
  const session = await getCurrentSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <EmployeesDirectoryView />
      </main>
    </div>
  );
}
