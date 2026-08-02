export type RequestDetailTab = 'overview' | 'discussion' | 'submissions' | 'history';

export const REQUEST_DETAIL_TABS: { id: RequestDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'history', label: 'History' },
];

export function parseRequestDetailTab(value: string | null | undefined): RequestDetailTab {
  if (
    value === 'overview' ||
    value === 'discussion' ||
    value === 'submissions' ||
    value === 'history'
  ) {
    return value;
  }
  return 'overview';
}
