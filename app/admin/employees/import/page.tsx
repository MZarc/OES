import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { ImportUploader } from '@/components/admin/ImportUploader';

export default async function ImportEmployeesPage() {
  const session = await getCurrentSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Import Employees
          </h1>
          <p className="text-xs text-slate-500">
            Upload spreadsheets, validate columns, review preview diagnostics, and queue automatic email invitations
          </p>
        </div>

        <ImportUploader />
      </main>
    </div>
  );
}
