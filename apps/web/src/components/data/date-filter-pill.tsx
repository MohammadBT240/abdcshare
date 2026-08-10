'use client';

import { useState } from 'react';
import { IconCalendar } from '@tabler/icons-react';
import { FilterPill } from '@/components/data/filter-pill';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateDisplay } from '@/components/forms/date-range-presets';
import { Button } from '@/components/ui/button';

export interface DateFilterPillProps {
  label: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  className?: string;
}

/** Filter pill that opens a titled Tailux-style calendar. */
export function DateFilterPill({ label, value, onChange, className }: DateFilterPillProps) {
  const [open, setOpen] = useState(false);
  const pillLabel = value ? `${label}: ${formatDateDisplay(value)}` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterPill
          active={open || Boolean(value)}
          icon={<IconCalendar className="h-4 w-4" />}
          label={pillLabel}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <div className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
          {label}
        </div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          defaultMonth={value}
          className="p-3"
        />
        {value ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
