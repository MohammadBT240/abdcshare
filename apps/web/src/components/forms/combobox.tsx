'use client';

import * as React from 'react';
import { IconCheck, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
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
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('h-11 w-full justify-between font-normal', className)}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Loading…
            </span>
          ) : (
            <span className={cn(!selected && 'text-muted-foreground')}>
              {selected?.label ?? (allowNone && !value ? noneLabel : placeholder)}
            </span>
          )}
          <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
