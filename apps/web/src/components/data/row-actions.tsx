'use client';

import { IconDots } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface RowActionItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export interface RowActionsProps {
  items: RowActionItem[];
  align?: 'start' | 'end';
}

export function RowActions({ items, align = 'end' }: RowActionsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0">
            <IconDots className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          {items.map((item) => (
            <span key={item.label}>
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                className={cn(
                  item.destructive && 'text-destructive focus:text-destructive',
                )}
                onClick={item.onClick}
              >
                {item.icon ? <span className="mr-2 inline-flex">{item.icon}</span> : null}
                {item.label}
              </DropdownMenuItem>
            </span>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
