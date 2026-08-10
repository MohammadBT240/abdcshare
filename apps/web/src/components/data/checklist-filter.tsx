'use client';

import { useMemo, useState } from 'react';
import { IconCheck, IconSearch } from '@tabler/icons-react';
import { FilterPill } from '@/components/data/filter-pill';
import { UserAvatar } from '@/components/data/user-avatar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface ChecklistFilterOption {
  value: string;
  label: string;
  avatarUrl?: string | null;
  initials?: string;
}

export interface ChecklistFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: ChecklistFilterOption[];
  /** Single-select value (preferred for most list filters). */
  value?: string;
  onChange?: (value: string | undefined) => void;
  /** Multi-select values — when set with onValuesChange, enables multi mode. */
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-card',
      )}
      aria-hidden
    >
      {checked ? <IconCheck className="h-3 w-3" /> : null}
    </span>
  );
}

function multiPillLabel(label: string, values: string[], options: ChecklistFilterOption[]): string {
  if (values.length === 0) return label;
  if (values.length === 1) {
    const one = options.find((o) => o.value === values[0]);
    return one ? `${label}: ${one.label}` : `${label}: 1 selected`;
  }
  const first = options.find((o) => o.value === values[0]);
  if (first) return `${label}: ${first.label} +${values.length - 1}`;
  return `${label}: ${values.length} selected`;
}

/** Filter pill + searchable checklist popover (single or multi). */
export function ChecklistFilter({
  label,
  icon,
  options,
  value,
  onChange,
  values,
  onValuesChange,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  className,
}: ChecklistFilterProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const multi = Boolean(onValuesChange);
  const selectedValues = multi ? (values ?? []) : value ? [value] : [];

  const selected = !multi ? options.find((o) => o.value === value) : undefined;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  const pillLabel = multi
    ? multiPillLabel(label, selectedValues, options)
    : selected
      ? `${label}: ${selected.label}`
      : label;

  function toggleMulti(optValue: string) {
    if (!onValuesChange) return;
    const set = new Set(selectedValues);
    if (set.has(optValue)) set.delete(optValue);
    else set.add(optValue);
    onValuesChange([...set]);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ('');
      }}
    >
      <PopoverTrigger asChild>
        <FilterPill
          active={open || selectedValues.length > 0}
          icon={icon}
          label={pillLabel}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 rounded-md border-0 bg-muted/50 pl-8 shadow-none focus-visible:ring-1"
            />
          </div>
        </div>
        <ScrollArea className="h-56">
          <ul className="p-1" role="listbox" aria-multiselectable={multi || undefined}>
            <li>
              <div
                role="option"
                aria-selected={selectedValues.length === 0}
                tabIndex={0}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60',
                  selectedValues.length === 0 && 'bg-muted/40',
                )}
                onClick={() => {
                  if (multi) onValuesChange?.([]);
                  else {
                    onChange?.(undefined);
                    setOpen(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (multi) onValuesChange?.([]);
                    else {
                      onChange?.(undefined);
                      setOpen(false);
                    }
                  }
                }}
              >
                <CheckMark checked={selectedValues.length === 0} />
                <span className="text-muted-foreground">All</span>
              </div>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                {options.length === 0 ? 'No options available' : emptyMessage}
              </li>
            ) : (
              filtered.map((opt) => {
                const checked = selectedValues.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <div
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60',
                        checked && 'bg-primary/5',
                      )}
                      onClick={() => {
                        if (multi) toggleMulti(opt.value);
                        else {
                          onChange?.(checked ? undefined : opt.value);
                          setOpen(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (multi) toggleMulti(opt.value);
                          else {
                            onChange?.(checked ? undefined : opt.value);
                            setOpen(false);
                          }
                        }
                      }}
                    >
                      <CheckMark checked={checked} />
                      {opt.avatarUrl !== undefined || opt.initials ? (
                        <UserAvatar
                          src={opt.avatarUrl}
                          initials={opt.initials ?? opt.label}
                          size="sm"
                          className="h-6 w-6 text-[9px]"
                        />
                      ) : null}
                      <span className="truncate">{opt.label}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
