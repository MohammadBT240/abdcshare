'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppHeaderSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { bffJson } from '@/lib/bff/client';
import { useInvalidateAuth } from '@/features/auth/hooks/use-auth';

export function AppHeader() {
  const { user, isPending } = useAuthContext();
  const router = useRouter();
  const invalidateAuth = useInvalidateAuth();

  async function logout() {
    try {
      await bffJson('/api/bff/auth/logout', { method: 'POST' });
      await invalidateAuth();
      router.replace('/login');
    } catch {
      toast.error('Logout failed');
    }
  }

  if (isPending || !user) return <AppHeaderSkeleton />;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border border-border bg-card px-6 shadow-aca">
      <span className="text-sm font-medium text-muted-foreground">ABDC · Practice Portal</span>
      <div className="flex items-center gap-3">
        <span className="text-sm">
          {user.fullName}{' '}
          <span className="text-muted-foreground">({user.role})</span>
        </span>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
