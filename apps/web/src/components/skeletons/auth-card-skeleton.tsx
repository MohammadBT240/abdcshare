import { AuthFormSkeleton } from './auth-form-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for auth form plane (card-less quiet split). */
export function AuthCardSkeleton() {
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <AuthFormSkeleton />
    </div>
  );
}
