'use client';

import { UserAvatar } from '@/components/data/user-avatar';
import { cn } from '@/lib/utils';

export interface EntityCellProps {
  primary: string;
  secondary?: string | null;
  avatarUrl?: string | null;
  initials?: string;
  className?: string;
}

export function EntityCell({
  primary,
  secondary,
  avatarUrl,
  initials,
  className,
}: EntityCellProps) {
  const fallback =
    initials ??
    (primary
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2) ||
      '?');

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <UserAvatar src={avatarUrl} initials={fallback} size="md" />
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{primary}</div>
        {secondary ? (
          <div className="truncate text-xs text-muted-foreground">{secondary}</div>
        ) : null}
      </div>
    </div>
  );
}
