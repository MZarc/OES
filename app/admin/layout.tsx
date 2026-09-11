import { getCurrentSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/login');` }} />
      </div>
    );
  }
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/dashboard');` }} />
      </div>
    );
  }

  return <>{children}</>;
}
