'use client';

import * as React from 'react';
import { IconCalendar } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDateDisplay } from '@/components/forms/date-range-presets';

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Optional titled header strip in the popover (Tailux-style). */
  title?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  className,
  title,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-11 w-full justify-start gap-2 rounded-lg text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <IconCalendar className="h-4 w-4 shrink-0 opacity-70" />
          {value ? formatDateDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-slot="calendar"], .rdp-root, [class*="rdp"]')) {
            e.preventDefault();
          }
        }}
      >
        {title ? (
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
            {title}
          </div>
        ) : null}
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          defaultMonth={value}
        />
      </PopoverContent>
    </Popover>
  );
}
