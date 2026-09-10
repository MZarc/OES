import { getCurrentSession } from '@/lib/auth/session';
import { getAuditLogsPaginatedAction } from '@/app/actions/audit';
import { Navbar } from '@/components/shared/Navbar';
import { AuditLogView } from '@/components/admin/AuditLogView';
import { ShieldCheck } from 'lucide-react';

export default async function AuditPage() {
  const session = await getCurrentSession();
  const initialData = await getAuditLogsPaginatedAction({ page: 1, limit: 20 });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Append-Only System Audit Log
            </h1>
            <p className="text-xs text-slate-500">
              OWASP-compliant immutable event log. Tracks administrative decisions, approvals, and mutations.
            </p>
          </div>
        </div>

        <AuditLogView initialLogs={initialData.logs as any} initialTotal={initialData.total} />
      </main>
    </div>
  );
}

