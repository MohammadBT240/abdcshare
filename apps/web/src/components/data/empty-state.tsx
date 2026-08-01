import { cn } from '@/lib/utils';

export function EmptyState({
  message = 'No records',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <p className={cn('py-8 text-center text-sm text-muted-foreground', className)}>{message}</p>
  );
}

export function ErrorState({
  message = 'Something went wrong',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return <p className={cn('py-8 text-center text-sm text-destructive', className)}>{message}</p>;
}
