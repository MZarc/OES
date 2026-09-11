'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, AlertCircle, Loader2, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { checkSystemInitializedAction, ensureDemoAccountAction } from '@/app/actions/setup';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutNotice, setTimeoutNotice] = useState(false);
  const [setupNotice, setSetupNotice] = useState(false);
  const [uninitializedNotice, setUninitializedNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'timeout') {
        setTimeoutNotice(true);
      }
      if (params.get('setup') === 'complete') {
        setSetupNotice(true);
      }
      if (params.get('fresh') === '1' || params.get('logout') === '1') {
        try {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(';').forEach((c) => {
            const eqPos = c.indexOf('=');
            const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          });
          window.history.replaceState({}, '', '/login');
        } catch {}
      }

      // If system is uninitialized, immediately redirect to setup wizard
      checkSystemInitializedAction().then(({ initialized }) => {
        if (!initialized) {
          router.replace('/setup');
        }
      }).catch(() => {});
    }
  }, [router]);

  async function executeSignIn(targetEmail: string, targetPassword: string) {
    setLoading(true);
    setError(null);

    try {
      // Better Auth email sign in endpoint
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim(), password: targetPassword }),
      });

      if (res.ok) {
        setIsRedirecting(true);
        window.location.href = targetEmail.trim().toLowerCase() === 'demo@oes.com' ? '/dashboard' : '/';
        return; // do not clear loading state
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Invalid email or password. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while signing in.');
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await executeSignIn(email, password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="relative max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 overflow-hidden">
        {isRedirecting && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30 animate-fade-in">
            <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mb-4" />
            <h3 className="text-base font-bold text-slate-900">Signing in...</h3>
            <p className="text-xs text-slate-500 mt-1">Authenticating and loading your workspace</p>
          </div>
        )}
        <div className="text-center mb-8">
          <img
            src="/icon-192.png"
            alt="OES App Logo"
            className="mx-auto h-14 w-14 rounded-2xl object-contain shadow-sm mb-3 hover:scale-105 transition-transform"
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">OES Portal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Overtime & Expense Management System
          </p>
        </div>

        {uninitializedNotice && (
          <div className="mb-6 p-3.5 bg-blue-50 text-blue-900 text-xs rounded-xl border border-blue-200 flex items-start gap-2.5 animate-slide-up">
            <ShieldAlert className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">First-Time Setup Required</span>
              <span className="text-blue-700">No administrator account exists yet. Initialize your root Super Admin account.</span>
              <div className="mt-2">
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-800 underline underline-offset-2 text-xs"
                >
                  Run Setup Wizard &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {setupNotice && (
          <div className="mb-6 flex items-center gap-2.5 p-3 bg-emerald-50 text-emerald-900 text-xs rounded-xl border border-emerald-200 animate-slide-up">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold">Setup Completed: </span>
              <span>System initialized successfully! Please sign in with your Super Administrator credentials.</span>
            </div>
          </div>
        )}

        {timeoutNotice && (
          <div className="mb-6 flex items-center gap-2.5 p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200 animate-slide-up">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div>
              <span className="font-bold">Session Timed Out: </span>
              <span>You were automatically signed out after 10 minutes of inactivity. Please sign in to continue.</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative rounded-lg shadow-sm">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative rounded-lg shadow-sm">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isRedirecting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {loading || isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in to Account...</span>
              </>
            ) : (
              <span>Sign In to Account</span>
            )}
          </button>
        </form>

        {/* Live Demo Sandbox Section */}
        {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'false' && (
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const prep = await ensureDemoAccountAction();
                  if (!prep.success) {
                    setError(prep.error || 'Failed to prepare demo account.');
                    setLoading(false);
                    return;
                  }
                } catch (e: any) {
                  setError(e.message || 'Demo preparation error.');
                  setLoading(false);
                  return;
                }
                setEmail('demo@oes.com');
                setPassword('demo123456');
                await executeSignIn('demo@oes.com', 'demo123456');
              }}
              disabled={loading || isRedirecting}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2 focus:outline-none disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {loading || isRedirecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Login to Demo Sandbox</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
