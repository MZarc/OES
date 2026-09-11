import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { OTHistoryView } from '@/components/ot/OTHistoryView';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default async function OTHistoryPage() {
  const session = await getCurrentSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'EMPLOYEE'}
        userName={session?.user?.name || 'Employee'}
        employeeCode={session?.employee?.employeeCode}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Overtime History
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and track all your logged overtime entries, rates, and approval statuses.
            </p>
          </div>
          <Link
            href="/ot/new"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            Log New Overtime
          </Link>
        </div>

        <OTHistoryView />
      </main>
    </div>
  );
}
