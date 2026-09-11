import { getCurrentSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { checkSystemInitializedAction } from '@/app/actions/setup';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    const { initialized } = await checkSystemInitializedAction();
    if (!initialized) {
      redirect('/setup');
    }
    redirect('/login');
  }

  // Demo user defaults to Employee Portal (/dashboard) for first-time showcase
  if (session.user.email === 'demo@oes.com') {
    redirect('/dashboard');
  }

  if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
    redirect('/admin/dashboard');
  }

  redirect('/dashboard');
}
