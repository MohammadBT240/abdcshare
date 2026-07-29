'use client';

import { useRouter } from 'next/navigation';
import { BadgeCheck, ChevronDown, Fingerprint, LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthUser } from '@abdcshare/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bffJson } from '@/lib/bff/client';
import { useInvalidateAuth } from '@/features/auth/hooks/use-auth';

function initialsOf(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function UserMenu({ user }: { user: AuthUser }) {
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

  const firstName = user.fullName.split(/\s+/)[0] ?? user.fullName;
  const shortId = user.id.split('-')[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-10 gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {initialsOf(user.fullName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-tight">{firstName}</span>
            <span className="block text-xs font-normal leading-tight text-muted-foreground">
              {user.role}
            </span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0">
        {/* Identity block — real session data only */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
            {initialsOf(user.fullName)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              {user.fullName}
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{user.role}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              User type
              <UserRound className="h-3 w-3" />
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm">{shortId}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              User ID
              <Fingerprint className="h-3 w-3" />
            </span>
          </div>
        </div>

        <div className="p-1">
          <DropdownMenuItem
            onSelect={() => void logout()}
            className="justify-center font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
