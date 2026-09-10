'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { resetEmployeePasswordAction } from '@/app/actions/employees';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!emailParam || !tokenParam) {
      setError('Missing reset link parameters. Please use the direct link sent to your email.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await resetEmployeePasswordAction({
        email: emailParam,
        token: tokenParam,
        password,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold shadow-sm mb-3">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset Password</h1>
        <p className="text-xs text-slate-500 mt-1">
          {emailParam ? `Resetting password for ${emailParam}` : 'Set a new secure password for your account'}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
          <div className="font-bold text-sm">Password Reset Successfully!</div>
          <p className="text-xs mt-1 text-emerald-600">Redirecting you to the login portal...</p>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (minimum 8 characters)
            </label>
            <div className="relative rounded-lg shadow-sm">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative rounded-lg shadow-sm">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              'Set New Password'
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading reset interface...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
