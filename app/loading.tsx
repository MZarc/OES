import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white shadow-xl border border-slate-100 max-w-sm text-center">
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Loading OES Platform</h3>
          <p className="text-xs text-slate-400 mt-0.5">Please wait a moment...</p>
        </div>
      </div>
    </div>
  );
}
