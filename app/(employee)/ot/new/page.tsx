import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';
import { OTForm } from '@/components/ot/OTForm';
import { db } from '@/db/client';
import { shifts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function NewOTPage() {
  const session = await getCurrentSession();
  const activeShifts = await db.query.shifts.findMany({
    where: eq(shifts.active, true),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'EMPLOYEE'}
        userName={session?.user?.name || 'Employee'}
        employeeCode={session?.employee?.employeeCode}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <OTForm
          availableShifts={activeShifts.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            startTime: s.startTime,
            endTime: s.endTime,
            regularOtStartTime: s.regularOtStartTime,
          }))}
        />
      </main>
    </div>
  );
}
