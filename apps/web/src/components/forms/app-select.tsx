'use client';

import { IconLoader2 } from '@tabler/icons-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AppSelectProps {
  options: AppSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  noneValue?: string;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  triggerClassName?: string;
}

/**
 * Controlled select. Never pass empty string as value — use undefined or allowNone sentinel.
 */
export function AppSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  allowNone = false,
  noneLabel = 'None',
  noneValue = 'none',
  isLoading = false,
  disabled = false,
  size = 'default',
  className,
  triggerClassName,
}: AppSelectProps) {
  const resolved =
    value && value.length > 0
      ? value
      : allowNone
        ? noneValue
        : undefined;

  return (
    <Select
      value={resolved}
      onValueChange={(v) => {
        if (allowNone && v === noneValue) {
          onValueChange('');
          return;
        }
        onValueChange(v);
      }}
      disabled={disabled || isLoading}
    >
      <SelectTrigger
        className={cn(
          size === 'sm' && 'h-9',
          triggerClassName,
          className,
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Loading…
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={noneValue}>{noneLabel}</SelectItem> : null}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
