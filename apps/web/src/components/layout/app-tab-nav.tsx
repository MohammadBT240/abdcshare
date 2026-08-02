'use client';

import type { ReactNode } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface AppTabNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface AppTabNavProps {
  items: AppTabNavItem[];
  className?: string;
}

/**
 * Segmented tab strip — muted track, pill active state.
 * Prefer this over underline-only tabs for workspace/detail pages.
 */
export function AppTabNav({ items, className }: AppTabNavProps) {
  return (
    <TabsList
      className={cn(
        'h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-muted/50 p-1',
        className,
      )}
    >
      {items.map((item) => (
        <TabsTrigger
          key={item.id}
          value={item.id}
          className={cn(
            'gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-none',
            'data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm',
            'data-[state=inactive]:hover:bg-background/60 data-[state=inactive]:hover:text-foreground',
          )}
        >
          {item.icon ? (
            <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span>
          ) : null}
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
