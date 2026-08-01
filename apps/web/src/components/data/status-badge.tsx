'use client';

import { Badge, type BadgeProps } from '@/components/ui/badge';

const STATUS_MAP: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  true: { label: 'Active', variant: 'success' },
  false: { label: 'Inactive', variant: 'secondary' },
};

export interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = String(status).toLowerCase();
  const mapped = STATUS_MAP[key];
  const display = label ?? mapped?.label ?? String(status);
  const variant = mapped?.variant ?? 'secondary';

  return (
    <Badge variant={variant} className={className}>
      {display}
    </Badge>
  );
}
