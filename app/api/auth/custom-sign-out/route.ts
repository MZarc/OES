import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.session?.id) {
      await db.delete(sessions).where(eq(sessions.id, session.session.id));
    }
    await auth.api.signOut({ headers: req.headers });
  } catch (err) {
    console.warn('Sign-out warning:', err);
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const response = NextResponse.json({ success: true });

  const knownAuthCookies = [
    'better-auth.session_token',
    '__Secure-better-auth.session_token',
    'better-auth.session_data',
    '__Secure-better-auth.session_data',
    'better-auth.csrf_token',
    '__Secure-better-auth.csrf_token',
  ];

  for (const name of knownAuthCookies) {
    cookieStore.delete(name);
    response.cookies.set(name, '', { maxAge: 0, path: '/', expires: new Date(0) });
  }

  for (const c of allCookies) {
    if (c.name.includes('better-auth') || c.name.includes('session')) {
      cookieStore.delete(c.name);
      response.cookies.set(c.name, '', { maxAge: 0, path: '/', expires: new Date(0) });
      response.cookies.set(`__Secure-${c.name}`, '', { maxAge: 0, path: '/', expires: new Date(0) });
    }
  }

  return response;
}
