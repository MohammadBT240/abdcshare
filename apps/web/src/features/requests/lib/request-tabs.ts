export type RequestDetailTab =
  | 'overview'
  | 'discussion'
  | 'submissions'
  | 'working-papers'
  | 'history';

export const REQUEST_DETAIL_TABS: { id: RequestDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'working-papers', label: 'Linked working papers' },
  { id: 'history', label: 'History' },
];

export function parseRequestDetailTab(value: string | null | undefined): RequestDetailTab {
  if (
    value === 'overview' ||
    value === 'discussion' ||
    value === 'submissions' ||
    value === 'working-papers' ||
    value === 'history'
  ) {
    return value;
  }
  return 'overview';
}
