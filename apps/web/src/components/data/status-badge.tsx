'use client';

import {
  StatusPill,
  formatStatusLabel,
  resolveStatusTone,
} from '@/components/data/status-pill';

export interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const display = label ?? formatStatusLabel(status);
  const tone = resolveStatusTone(status);

  return (
    <StatusPill tone={tone} className={className}>
      {display}
    </StatusPill>
  );
}
