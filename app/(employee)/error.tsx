'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Portal Error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="mx-auto w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">Unable to load requested view</h2>
          <p className="text-sm text-slate-500 mt-1">
            {error?.message || 'A temporary data loading issue occurred. Your data is safe.'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Employee Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
