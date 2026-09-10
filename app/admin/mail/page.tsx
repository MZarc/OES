import { MailSystemView } from '@/components/admin/MailSystemView';
import { getMailSystemStatusAction } from '@/app/actions/mail';
import { getCurrentSession } from '@/lib/auth/session';
import { Navbar } from '@/components/shared/Navbar';

export default async function AdminMailPage() {
  const session = await getCurrentSession();
  const initialStatus = await getMailSystemStatusAction();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userRole={session?.user?.role || 'ADMIN'}
        userName={session?.user?.name || 'Admin'}
        employeeCode="ADM001"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
        <MailSystemView initialStatus={initialStatus} />
      </main>
    </div>
  );
}
