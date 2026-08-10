'use client';

import * as React from 'react';
import { IconCheck, IconChevronDown, IconLoader2, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/data/user-avatar';
import { cn } from '@/lib/utils';

export interface MultiComboboxOption {
  value: string;
  label: string;
  /** Secondary line (role, email, etc.). */
  description?: string;
  avatarUrl?: string | null;
  disabled?: boolean;
}

export interface MultiComboboxProps {
  options: MultiComboboxOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Max chips before “+N more” (default: show all wrapping). */
  maxChips?: number;
}

export function MultiCombobox({
  options,
  values,
  onValuesChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  isLoading = false,
  disabled = false,
  className,
  maxChips,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(values), [values]);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));
  const visibleChips =
    maxChips != null && selectedOptions.length > maxChips
      ? selectedOptions.slice(0, maxChips)
      : selectedOptions;
  const overflow =
    maxChips != null ? Math.max(0, selectedOptions.length - maxChips) : 0;

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onValuesChange(values.filter((v) => v !== value));
    } else {
      onValuesChange([...values, value]);
    }
  }

  function remove(value: string, event: React.MouseEvent) {
    event.stopPropagation();
    onValuesChange(values.filter((v) => v !== value));
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            'h-auto min-h-11 w-full justify-between gap-2 px-3 py-2 font-normal',
            className,
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Loading…
            </span>
          ) : selectedOptions.length === 0 ? (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {visibleChips.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
                >
                  {opt.avatarUrl !== undefined ? (
                    <UserAvatar
                      src={opt.avatarUrl}
                      initials={opt.label.slice(0, 2)}
                      size="sm"
                      className="h-4 w-4 text-[9px]"
                    />
                  ) : null}
                  <span className="truncate">{opt.label}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label={`Remove ${opt.label}`}
                    onClick={(e) => remove(opt.value, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        remove(opt.value, e as unknown as React.MouseEvent);
                      }
                    }}
                  >
                    <IconX className="h-3 w-3 text-muted-foreground" />
                  </span>
                </span>
              ))}
              {overflow > 0 ? (
                <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{overflow} more
                </span>
              ) : null}
            </span>
          )}
          <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.description ?? ''} ${opt.value}`}
                    disabled={opt.disabled}
                    onSelect={() => toggle(opt.value)}
                  >
                    <span
                      className={cn(
                        'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-card',
                      )}
                      aria-hidden
                    >
                      {checked ? <IconCheck className="h-3 w-3" /> : null}
                    </span>
                    {opt.avatarUrl !== undefined ? (
                      <UserAvatar
                        src={opt.avatarUrl}
                        initials={opt.label.slice(0, 2)}
                        size="sm"
                        className="mr-2 h-7 w-7"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
