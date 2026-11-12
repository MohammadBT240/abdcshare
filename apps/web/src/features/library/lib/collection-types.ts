import {
  IconBriefcase,
  IconCalendarEvent,
  IconFolders,
  IconPresentation,
  IconSchool,
  IconTimeline,
  type Icon,
} from '@tabler/icons-react';
import type { LibraryCollectionType } from '@/features/library/types';

export const COLLECTION_TYPES: { value: LibraryCollectionType; label: string; icon: Icon }[] = [
  { value: 'Training', label: 'Training', icon: IconSchool },
  { value: 'Workshop', label: 'Workshop', icon: IconPresentation },
  { value: 'Conference', label: 'Conference', icon: IconCalendarEvent },
  { value: 'Project', label: 'Project', icon: IconBriefcase },
  { value: 'Programme', label: 'Programme', icon: IconTimeline },
  { value: 'Other', label: 'Other', icon: IconFolders },
];

export function collectionTypeMeta(type: LibraryCollectionType) {
  return COLLECTION_TYPES.find((t) => t.value === type) ?? COLLECTION_TYPES[COLLECTION_TYPES.length - 1]!;
}

/** "10–12 Mar 2026", "10 Mar 2026", or null. Dates are YYYY-MM-DD (no time zone). */
export function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', opts);
  if (!startsOn) return null;
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!endsOn || endsOn === startsOn) return fmt(startsOn, full);
  const [sy, sm] = startsOn.split('-');
  const [ey, em] = endsOn.split('-');
  if (sy === ey && sm === em) return `${Number(startsOn.slice(8))}–${fmt(endsOn, full)}`;
  if (sy === ey) return `${fmt(startsOn, { day: 'numeric', month: 'short' })} – ${fmt(endsOn, full)}`;
  return `${fmt(startsOn, full)} – ${fmt(endsOn, full)}`;
}
