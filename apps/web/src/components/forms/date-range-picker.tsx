'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { IconCalendar } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  DATE_RANGE_PRESETS,
  formatDateRangeDisplay,
  matchPresetId,
  type DateRangeValue,
} from '@/components/forms/date-range-presets';

export interface DateRangePickerProps {
  value?: DateRangeValue;
  onApply: (range: DateRangeValue | undefined) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * SmartHR-style range picker: presets apply on click; Custom requires Apply.
 */
export function DateRangePicker({
  value,
  onApply,
  onClear,
  placeholder = 'Select date range',
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined,
  );
  const [activePreset, setActivePreset] = React.useState<string | 'custom' | null>(
    matchPresetId(value),
  );

  React.useEffect(() => {
    if (open) {
      setDraft(value ? { from: value.from, to: value.to } : undefined);
      setActivePreset(matchPresetId(value));
    }
  }, [open, value]);

  function applyPreset(id: string) {
    const preset = DATE_RANGE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const range = preset.range();
    setDraft({ from: range.from, to: range.to });
    setActivePreset(id);
    onApply(range);
    setOpen(false);
  }

  function handleApply() {
    if (!draft?.from || !draft.to) return;
    onApply({ from: draft.from, to: draft.to });
    setOpen(false);
  }

  const display = formatDateRangeDisplay(value) || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 min-w-[14rem] justify-start gap-2 text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <IconCalendar className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  activePreset === preset.id && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                activePreset === 'custom' && 'bg-primary text-primary-foreground hover:bg-primary',
              )}
              onClick={() => setActivePreset('custom')}
            >
              Custom Range
            </button>
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              onSelect={(range) => {
                setDraft(range);
                setActivePreset('custom');
              }}
              defaultMonth={draft?.from ?? value?.from}
            />
            <Separator className="my-2" />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
              <p className="text-xs text-muted-foreground">
                {draft?.from && draft.to
                  ? formatDateRangeDisplay({ from: draft.from, to: draft.to })
                  : 'Select a start and end date'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(undefined);
                    setActivePreset(null);
                    onClear?.();
                    onApply(undefined);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draft?.from || !draft.to}
                  onClick={handleApply}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
