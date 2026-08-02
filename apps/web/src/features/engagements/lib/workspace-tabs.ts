import type { EngagementStage } from '@/features/engagements/lib/stage-styles';

export type WorkspaceTab = 'overview' | 'requests' | 'settings';

export const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'settings', label: 'Settings' },
];

export function defaultTabForStage(stage: EngagementStage): WorkspaceTab {
  if (stage === 'Execution' || stage === 'Reporting') return 'requests';
  return 'overview';
}

/** Accepts current ids plus legacy `planning` / `work` / `admin` query values. */
export function parseWorkspaceTab(value: string | null | undefined): WorkspaceTab | null {
  if (value === 'overview' || value === 'requests' || value === 'settings') {
    return value;
  }
  if (value === 'planning') return 'overview';
  if (value === 'work') return 'requests';
  if (value === 'admin') return 'settings';
  return null;
}
