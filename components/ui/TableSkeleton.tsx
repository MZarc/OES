import React from 'react';
import { Skeleton } from './Skeleton';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}

export function TableSkeleton({
  columns = 5,
  rows = 6,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {showHeader && (
        <div className="border-b border-slate-200 bg-slate-50/75 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {/* Table Column Header Skeleton */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={`th-${i}`}
              className={columns === 4 ? 'col-span-3' : columns === 5 ? 'col-span-2' : 'col-span-2'}
            >
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>

        {/* Table Rows Skeleton */}
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={`row-${rIdx}`}
            className="grid grid-cols-12 gap-4 px-6 py-4 items-center animate-pulse"
            style={{ animationDelay: `${rIdx * 75}ms` }}
          >
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={`cell-${rIdx}-${cIdx}`}
                className={columns === 4 ? 'col-span-3' : columns === 5 ? 'col-span-2' : 'col-span-2'}
              >
                {cIdx === 0 ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ) : cIdx === columns - 1 ? (
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-7 w-16 rounded-md" />
                  </div>
                ) : (
                  <Skeleton className="h-3.5 w-4/5" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
