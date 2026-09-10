import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { TableSkeleton } from '@/components/ui/TableSkeleton';

export default function EmployeeLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar Skeleton */}
      <div className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Skeleton className="h-7 w-28" />
          <div className="hidden md:flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        {/* Welcome Banner Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Content Skeleton */}
        <TableSkeleton columns={5} rows={4} />
      </main>
    </div>
  );
}
