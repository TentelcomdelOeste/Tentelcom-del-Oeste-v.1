import React from 'react';
import Skeleton from './Skeleton';

interface TableSkeletonProps {
  rows?: number;
}

export default function TableSkeleton({ rows = 6 }: TableSkeletonProps) {
  return (
    <div className="space-y-3 w-full py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-full opacity-60" />
        </div>
      ))}
    </div>
  );
}