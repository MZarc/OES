'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, AlertCircle, Loader2, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { checkSystemInitializedAction } from '@/app/actions/setup';

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
        fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {});
      }

      // Check if system is uninitialized
      checkSystemInitializedAction().then(({ initialized }) => {
        if (!initialized) {
          setUninitializedNotice(true);
        }
      }).catch(() => {});
    }
  }, []);

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
        window.location.href = '/';
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

  function handleSelectDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
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

        {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true' && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
              One-Click Demo Credentials
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: 'Super Admin', email: 'admin@oes.local', pass: 'Admin@123456', desc: 'Full System Access' },
                { role: 'Meet Mistry', email: 'meet@oes.local', pass: 'Employee@123', desc: 'First Shift (7-15)' },
                { role: 'John Wick', email: 'john.wick@oes.local', pass: 'Employee@123', desc: 'General Shift (8:30-17:15)' },
                { role: 'Bruce Wayne', email: 'bruce.wayne@oes.local', pass: 'Employee@123', desc: 'Night Shift (23-07)' },
              ].map((d) => {
                const isSelected = email === d.email;
                return (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => handleSelectDemo(d.email, d.pass)}
                    className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{d.role}</span>
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{d.email}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{d.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
