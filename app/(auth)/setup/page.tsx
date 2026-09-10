'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, User, Lock, AlertCircle, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { checkSystemInitializedAction, initializeSuperAdminAction } from '@/app/actions/setup';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyStatus() {
      try {
        const { initialized } = await checkSystemInitializedAction();
        if (initialized) {
          router.replace('/login');
        } else {
          setChecking(false);
        }
      } catch {
        setChecking(false);
      }
    }
    verifyStatus();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const result = await initializeSuperAdminAction({
        fullName,
        email,
        password,
      });

      if (!result.success) {
        setError(result.error || 'Failed to initialize setup.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login?setup=complete');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-xs font-medium text-slate-500">Checking system initialization status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="relative max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Initialization</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Welcome to OES. No administrator account exists yet. Create your root Super Administrator account to begin.
          </p>
        </div>

        {/* Success Banner */}
        {success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center animate-fade-in">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-emerald-900">System Successfully Initialized!</h3>
            <p className="text-xs text-emerald-700 mt-1 mb-4">
              Your Super Administrator account has been provisioned. Redirecting you to sign in...
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to Login</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 animate-shake">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Full Name
              </label>
              <div className="relative rounded-lg shadow-xs">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Meet Mistry"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email Address
              </label>
              <div className="relative rounded-lg shadow-xs">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourcompany.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Master Password
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700">Security Note:</div>
              <div>• This will create the root system owner with full administrative privileges.</div>
              <div>• Once configured, this initialization wizard is permanently locked.</div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-xl text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Provisioning Super Administrator...</span>
                </>
              ) : (
                <>
                  <span>Create Super Admin Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
