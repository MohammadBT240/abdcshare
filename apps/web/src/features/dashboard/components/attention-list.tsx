'use client';

import Link from 'next/link';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EmptyState } from './decor';
import type { AttentionItem, AttentionSeverity } from '../types';

const ICONS: Record<AttentionSeverity, typeof IconAlertCircle> = {
  critical: IconAlertCircle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

const TONE: Record<AttentionSeverity, string> = {
  critical: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-primary',
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Nothing urgent right now"
            hint="You are all caught up. New items will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.severity];
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[item.severity])} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.meta ? (
                  <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
