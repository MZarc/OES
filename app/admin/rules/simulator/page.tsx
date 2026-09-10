import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/db/client';
import { shifts } from '@/db/schema';
import { Navbar } from '@/components/shared/Navbar';
import { RuleSimulator } from '@/components/admin/RuleSimulator';

export default async function SimulatorPage() {
  const session = await getCurrentSession();
  const allShifts = await db.query.shifts.findMany();

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
            OT Rule Simulator & Policy Sandbox
          </h1>
          <p className="text-xs text-slate-500">
            Interactive sandbox to test shifts, midnight-crossing, Sunday/holiday multipliers, and rounding before updating policy
          </p>
        </div>

        <RuleSimulator
          shifts={allShifts.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            regularOtStartTime: s.regularOtStartTime,
          }))}
        />
      </main>
    </div>
  );
}
