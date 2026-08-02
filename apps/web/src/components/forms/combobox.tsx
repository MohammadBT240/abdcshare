'use client';

import * as React from 'react';
import { IconCheck, IconChevronDown, IconLoader2, IconPlus } from '@tabler/icons-react';
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
import { cn } from '@/lib/utils';
import type { AppSelectOption } from '@/components/forms/app-select';

export interface ComboboxProps {
  options: AppSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowNone?: boolean;
  noneLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Show “Create …” when the search text matches no option exactly (case-insensitive). */
  creatable?: boolean;
  onCreate?: (name: string) => void | Promise<void>;
  creating?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  allowNone = false,
  noneLabel = 'None',
  isLoading = false,
  disabled = false,
  className,
  creatable = false,
  onCreate,
  creating = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const selected = options.find((o) => o.value === value);

  const trimmed = search.trim();
  const exactMatch = options.some(
    (o) => o.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = Boolean(creatable && onCreate && trimmed && !exactMatch);

  React.useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  async function handleCreate() {
    if (!onCreate || !trimmed || creating) return;
    try {
      await onCreate(trimmed);
      setOpen(false);
      setSearch('');
    } catch {
      // Parent handles toast; keep popover open for retry.
    }
  }

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        if (creating) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading || creating}
          className={cn('h-11 w-full justify-between font-normal', className)}
        >
          {isLoading || creating ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              {creating ? 'Creating…' : 'Loading…'}
            </span>
          ) : (
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.label ?? (allowNone && !value ? noneLabel : placeholder)}
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
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{showCreate ? 'No exact match' : emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allowNone ? (
                <CommandItem
                  value={noneLabel}
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                >
                  <IconCheck className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  disabled={opt.disabled}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <IconCheck
                    className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')}
                  />
                  {opt.label}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem
                  value={`__create__${trimmed}`}
                  disabled={creating}
                  onSelect={() => {
                    void handleCreate();
                  }}
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Create &quot;{trimmed}&quot;
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
