'use client';

import type { ReactNode } from 'react';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconFileUpload,
  IconLayersLinked,
  IconUsers,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { EngagementWorkspace } from '@/features/engagements/hooks/use-engagements';
import type { WorkspaceTab } from '@/features/engagements/lib/workspace-tabs';

export type NextActionTone = 'neutral' | 'warning' | 'destructive';

export interface NextAction {
  id: string;
  label: string;
  tone: NextActionTone;
  tab?: WorkspaceTab;
  /** Extra query params when selecting a tab (e.g. documents category). */
  query?: Record<string, string>;
  onClick?: () => void;
}

interface NextActionChipsProps {
  actions: NextAction[];
  onSelectTab: (tab: WorkspaceTab, query?: Record<string, string>) => void;
}

const toneClass: Record<NextActionTone, string> = {
  neutral:
    'border-border bg-background/80 hover:bg-muted/70 dark:bg-background/40',
  warning:
    'border-amber-300/80 bg-amber-50 text-amber-950 hover:bg-amber-100/80 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100',
  destructive:
    'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10',
};

export function buildNextActions(input: {
  workspace: EngagementWorkspace;
  planningDocCount: number;
  canUpdate: boolean;
  canUploadSupporting?: boolean;
  canSignOff: boolean;
  canTransition: boolean;
  onTransition: () => void;
}): NextAction[] {
  const {
    workspace,
    planningDocCount,
    canUpdate,
    canUploadSupporting = false,
    canSignOff,
    canTransition,
    onTransition,
  } = input;
  const actions: NextAction[] = [];
  const classCount = workspace.classRollups?.length ?? 0;
  const unsigned = workspace.missingRequestClassIds?.length ?? 0;

  if (canUpdate && workspace.team.length === 0) {
    actions.push({
      id: 'add-team',
      label: 'Add team members',
      tone: 'warning',
      tab: 'settings',
    });
  }

  if (
    workspace.stage === 'Planning' &&
    planningDocCount === 0 &&
    (canUpdate || canUploadSupporting)
  ) {
    actions.push({
      id: 'upload-planning',
      label: 'Upload planning document',
      tone: 'warning',
      tab: 'overview',
    });
  }

  if (canUpdate && classCount === 0) {
    actions.push({
      id: 'add-classes',
      label: 'Add request classes',
      tone: 'warning',
      tab: 'settings',
    });
  }

  if (workspace.overdueCount > 0) {
    actions.push({
      id: 'overdue',
      label: `Review ${workspace.overdueCount} overdue request${workspace.overdueCount === 1 ? '' : 's'}`,
      tone: 'destructive',
      tab: 'requests',
    });
  }

  const firmReportAction = workspace.finalReportsNeedingFirmAction ?? 0;
  if (firmReportAction > 0) {
    actions.push({
      id: 'final-report-revision',
      label:
        firmReportAction === 1
          ? 'Final report needs revision'
          : `${firmReportAction} final reports need revision`,
      tone: 'warning',
      tab: 'documents',
      query: { category: 'FinalReport' },
    });
  }

  if (
    canSignOff &&
    unsigned > 0 &&
    classCount > 0 &&
    !workspace.hasEngagementWideSignOff
  ) {
    actions.push({
      id: 'sign-off',
      label: `Sign off ${unsigned} class${unsigned === 1 ? '' : 'es'} before completion`,
      tone: 'warning',
      tab: 'settings',
    });
  }

  if (canTransition && workspace.allowedNextStages.length > 0) {
    actions.push({
      id: 'transition',
      label: `Advance to ${workspace.allowedNextStages[0]}`,
      tone: 'neutral',
      onClick: onTransition,
    });
  }

  return actions.slice(0, 5);
}

const icons: Record<string, ReactNode> = {
  'add-team': <IconUsers className="h-3.5 w-3.5 shrink-0" />,
  'upload-planning': <IconFileUpload className="h-3.5 w-3.5 shrink-0" />,
  'add-classes': <IconLayersLinked className="h-3.5 w-3.5 shrink-0" />,
  overdue: <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />,
  'final-report-revision': <IconFileUpload className="h-3.5 w-3.5 shrink-0" />,
  'sign-off': <IconCheck className="h-3.5 w-3.5 shrink-0" />,
  transition: <IconArrowRight className="h-3.5 w-3.5 shrink-0" />,
};

/** Compact chip row for secondary next steps (transition handled as primary CTA). */
export function NextActionChips({ actions, onSelectTab }: NextActionChipsProps) {
  if (actions.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <li key={action.id}>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              toneClass[action.tone],
            )}
            onClick={() => {
              if (action.onClick) action.onClick();
              else if (action.tab) onSelectTab(action.tab, action.query);
            }}
          >
            {icons[action.id] ?? null}
            {action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
