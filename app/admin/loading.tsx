import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { TableSkeleton } from '@/components/ui/TableSkeleton';

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Navbar Skeleton */}
      <div className="bg-slate-900 border-b border-slate-800 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Skeleton className="h-7 w-32 bg-slate-800" />
          <div className="hidden md:flex gap-4">
            <Skeleton className="h-4 w-20 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-full bg-slate-800" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Data Table Skeleton */}
        <TableSkeleton columns={6} rows={6} />
      </main>
    </div>
  );
}
