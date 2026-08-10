'use client';

import { UserAvatar } from '@/components/data/user-avatar';
import { cn } from '@/lib/utils';

export interface AvatarStackPerson {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  max?: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2);
  const second = parts[1] ?? '';
  return `${first[0] ?? ''}${second[0] ?? ''}`;
}

/** Overlapping avatar stack with +N overflow (Tailux collaborators). */
export function AvatarStack({ people, max = 4, className }: AvatarStackProps) {
  if (people.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((p) => (
        <UserAvatar
          key={p.id}
          src={p.avatarUrl}
          initials={initials(p.fullName)}
          alt={p.fullName}
          size="sm"
          className="ring-2 ring-background"
        />
      ))}
      {overflow > 0 ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
