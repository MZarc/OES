import { getCurrentSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/login');` }} />
      </div>
    );
  }

  return <>{children}</>;
}
