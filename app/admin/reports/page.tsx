import { getMonthlySummaryAction } from '@/app/actions/reports';
import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { ReportsView } from '@/components/admin/ReportsView';
import { FileText } from 'lucide-react';

export default async function ReportsPage() {
  const session = await getCurrentSession();
  const summaryData = await getMonthlySummaryAction(undefined, { page: 1, limit: 15 });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Overtime & Expense Reports
              </h1>
              <p className="text-xs text-slate-500">
                Detailed overtime hours and approved expense claim breakdowns with date range filtering and CSV export.
              </p>
            </div>
          </div>
        </div>

        <ReportsView initialData={summaryData} />
      </main>
    </div>
  );
}
