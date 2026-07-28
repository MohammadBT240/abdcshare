import { AuthFormSkeleton } from './auth-form-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-aca">
        <AuthFormSkeleton />
      </div>
    </div>
  );
}
