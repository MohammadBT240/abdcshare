import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

export type DateRangeValue = { from: Date; to: Date };

export interface DateRangePreset {
  id: string;
  label: string;
  range: () => DateRangeValue;
}

export function formatDateDisplay(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

export function formatDateRangeDisplay(range: DateRangeValue | undefined): string {
  if (!range?.from) return '';
  if (!range.to) return formatDateDisplay(range.from);
  return `${formatDateDisplay(range.from)} - ${formatDateDisplay(range.to)}`;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    id: 'last30',
    label: 'Last 30 Days',
    range: () => {
      const to = endOfDay(new Date());
      return { from: startOfDay(subDays(to, 29)), to };
    },
  },
  {
    id: 'last7',
    label: 'Last 7 Days',
    range: () => {
      const to = endOfDay(new Date());
      return { from: startOfDay(subDays(to, 6)), to };
    },
  },
  {
    id: 'lastMonth',
    label: 'Last Month',
    range: () => {
      const last = subMonths(new Date(), 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    },
  },
  {
    id: 'thisMonth',
    label: 'This Month',
    range: () => {
      const now = new Date();
      return { from: startOfMonth(now), to: endOfMonth(now) };
    },
  },
  {
    id: 'today',
    label: 'Today',
    range: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    range: () => {
      const y = subDays(new Date(), 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
];

export function matchPresetId(range: DateRangeValue | undefined): string | 'custom' | null {
  if (!range?.from || !range.to) return null;
  for (const preset of DATE_RANGE_PRESETS) {
    const p = preset.range();
    if (
      startOfDay(p.from).getTime() === startOfDay(range.from).getTime() &&
      startOfDay(p.to).getTime() === startOfDay(range.to).getTime()
    ) {
      return preset.id;
    }
  }
  return 'custom';
}
