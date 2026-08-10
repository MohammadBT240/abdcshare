'use client';

import { useRouter } from 'next/navigation';
import { IconChevronDown, IconLogout, IconSettings } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { AuthUser } from '@abdcshare/api-client';
import { UserAvatar } from '@/components/data/user-avatar';
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
import { useAuthStore } from '@/store/useAuthStore';

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
  const clearUser = useAuthStore((s) => s.clearUser);

  async function logout() {
    try {
      await bffJson('/api/bff/auth/logout', { method: 'POST' });
      clearUser();
      await invalidateAuth();
      router.replace('/login');
    } catch {
      toast.error('Logout failed');
    }
  }

  const firstName = user.fullName.split(/\s+/)[0] ?? user.fullName;
  const initials = initialsOf(user.fullName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-10 gap-2 px-2">
          <UserAvatar
            src={user.avatarUrl}
            initials={initials}
            size="sm"
            className="rounded-md"
            alt={user.fullName}
          />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-tight">{firstName}</span>
            <span className="block text-xs font-normal leading-tight text-muted-foreground">
              {user.role}
            </span>
          </span>
          <IconChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <UserAvatar
            src={user.avatarUrl}
            initials={initials}
            size="md"
            className="h-11 w-11 shrink-0 rounded-md text-sm"
            alt={user.fullName}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="p-1">
          <DropdownMenuItem
            onSelect={() => router.push('/settings/account')}
            className="cursor-pointer"
          >
            <IconSettings className="mr-2 h-4 w-4" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void logout()}
            className="cursor-pointer font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <IconLogout className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
