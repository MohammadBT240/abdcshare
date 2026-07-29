import { AuthFormSkeleton } from './auth-form-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="space-y-6 rounded-lg border border-border bg-card p-8 shadow-aca">
        <div className="flex flex-col items-center space-y-2">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <AuthFormSkeleton />
        <div className="flex justify-center gap-4 border-t border-border pt-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
