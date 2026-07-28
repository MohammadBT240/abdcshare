'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardSkeleton, PageHeaderSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { bffJson } from '@/lib/bff/client';

type HealthResponse = { status?: string; ok?: boolean };

export default function DashboardPage() {
  const { user, isPending } = useAuthContext();

  const health = useQuery({
    queryKey: ['bff', 'health'],
    queryFn: () => bffJson<HealthResponse>('/api/bff/health'),
    staleTime: 30_000,
  });

  if (isPending || !user) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.fullName} · {user.role}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-aca">
          <h2 className="text-sm font-medium text-muted-foreground">Your account</h2>
          <p className="mt-2 text-lg font-semibold">{user.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">Role: {user.role}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-aca">
          <h2 className="text-sm font-medium text-muted-foreground">API status</h2>
          {health.isPending ? (
            <PageHeaderSkeleton />
          ) : health.isError ? (
            <p className="mt-2 text-sm text-destructive">Unable to reach API</p>
          ) : (
            <p className="mt-2 text-lg font-semibold capitalize">
              {health.data?.status ?? (health.data?.ok ? 'ok' : 'unknown')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
