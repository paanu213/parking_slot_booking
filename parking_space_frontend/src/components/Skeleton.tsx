import { cn } from '@/lib/cn';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />
);

export const CardSkeleton = () => (
  <div className="card p-4 space-y-3">
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);
