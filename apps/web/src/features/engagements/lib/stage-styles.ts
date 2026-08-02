export type EngagementStage = 'Planning' | 'Execution' | 'Reporting' | 'Completed' | 'Archived';

export interface StageStyle {
  label: string;
  variant: 'default' | 'secondary' | 'success' | 'destructive' | 'outline';
  className?: string;
}

/** Functional stage colors (ACA light brand — avoid purple/glow). */
export const STAGE_STYLES: Record<EngagementStage, StageStyle> = {
  Planning: {
    label: 'Planning',
    variant: 'secondary',
    className:
      'border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
  },
  Execution: {
    label: 'Execution',
    variant: 'outline',
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  },
  Reporting: {
    label: 'Reporting',
    variant: 'default',
    className:
      'border-transparent bg-teal-100 text-teal-900 dark:bg-teal-950/45 dark:text-teal-100',
  },
  Completed: {
    label: 'Completed',
    variant: 'success',
  },
  Archived: {
    label: 'Archived',
    variant: 'secondary',
  },
};

export function getStageStyle(stage: EngagementStage): StageStyle {
  return STAGE_STYLES[stage] ?? STAGE_STYLES.Planning;
}

export const statusTone = {
  overdue: 'text-destructive',
  warning: 'text-amber-800 dark:text-amber-200',
  healthy: 'text-primary',
  muted: 'text-muted-foreground',
} as const;
