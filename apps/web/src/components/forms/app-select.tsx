'use client';

import { Combobox } from '@/components/forms/combobox';
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
  searchPlaceholder?: string;
  emptyMessage?: string;
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
 * Searchable select (Combobox) used across list filters and forms.
 * Empty-string values are supported for “All …” filter options.
 */
export function AppSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  allowNone = false,
  noneLabel = 'None',
  noneValue = 'none',
  isLoading = false,
  disabled = false,
  size = 'default',
  className,
  triggerClassName,
}: AppSelectProps) {
  const normalizedOptions = options.map((opt) =>
    opt.value === ''
      ? { ...opt, value: noneValue }
      : opt,
  );

  const hasEmptySentinel = options.some((o) => o.value === '');
  const resolvedValue =
    value === '' && hasEmptySentinel
      ? noneValue
      : value && value.length > 0
        ? value
        : allowNone
          ? noneValue
          : undefined;

  return (
    <Combobox
      options={normalizedOptions}
      value={resolvedValue}
      onValueChange={(v) => {
        if (v === noneValue) {
          onValueChange(hasEmptySentinel || allowNone ? '' : v);
          return;
        }
        onValueChange(v);
      }}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      allowNone={allowNone && !hasEmptySentinel}
      noneLabel={noneLabel}
      isLoading={isLoading}
      disabled={disabled}
      className={cn(size === 'sm' && 'h-9', triggerClassName, className)}
    />
  );
}
