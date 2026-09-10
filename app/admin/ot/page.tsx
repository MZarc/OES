import { getAdminPendingOTAction } from '@/app/actions/ot';
import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { PendingOTTable } from '@/components/admin/PendingOTTable';

export default async function AdminOTPage() {
  const session = await getCurrentSession();
  const records = await getAdminPendingOTAction();

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
            Overtime Approvals & Review
          </h1>
          <p className="text-xs text-slate-500">
            Review pending OT submissions with transparent calculation traces and mandatory audit reasons
          </p>
        </div>

        <PendingOTTable initialRecords={records as any} />
      </main>
    </div>
  );
}
