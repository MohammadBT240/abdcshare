'use client';

import { IconBriefcase, IconCalendar, IconUsers, IconFileText, IconArrowRight } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EngagementStageBadge } from '@/features/engagements/components/engagement-stage-badge';
import type { EngagementWorkspace } from '@/features/engagements/hooks/use-engagements';
import { cn } from '@/lib/utils';

interface EngagementHeroProps {
  workspace: EngagementWorkspace;
  onTransition?: () => void;
  canTransition: boolean;
}

export function EngagementHero({ workspace, onTransition, canTransition }: EngagementHeroProps) {
  const WORKFLOW_STAGES = ['Planning', 'Execution', 'Reporting'];
  const currentIndex = WORKFLOW_STAGES.indexOf(workspace.stage);
  const isWorkflowStage = currentIndex >= 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <IconBriefcase className="h-4 w-4" />
              <span className="font-medium">{workspace.referenceCode}</span>
            </div>
            <h1 className="mb-1 text-2xl font-bold">{workspace.title}</h1>
            {workspace.periodLabel ? (
              <p className="text-muted-foreground">{workspace.periodLabel}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <EngagementStageBadge stage={workspace.stage} />
            {canTransition && workspace.allowedNextStages.length > 0 ? (
              <Button onClick={onTransition} size="sm">
                <IconArrowRight className="mr-2 h-4 w-4" />
                Transition
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <IconUsers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Team size</p>
              <p className="text-xl font-bold">{workspace.team.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
            <div className="rounded-md bg-primary/10 p-2">
              <IconFileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Requests</p>
              <p className="text-xl font-bold">{workspace.requestCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
            <div className="rounded-md bg-destructive/10 p-2">
              <IconCalendar className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-xl font-bold">{workspace.overdueCount}</p>
            </div>
          </div>
        </div>

        {isWorkflowStage ? (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{workspace.progressPercent}%</span>
            </div>
            <Progress value={workspace.progressPercent} className="h-2" />
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {WORKFLOW_STAGES.map((stage, idx) => {
              const isActive = idx === currentIndex;
              const isPast = idx < currentIndex;
              return (
                <div
                  key={stage}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isPast
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {stage}
                </div>
              );
            })}
            {!isWorkflowStage ? (
              <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium">
                {workspace.stage}
              </div>
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Client:</span> {workspace.clientName} •{' '}
            <span className="font-medium">Type:</span> {workspace.engagementTypeName}
          </div>
        </div>

        {(workspace.startDate || workspace.targetCompletionDate) ? (
          <div className="mt-4 flex gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
            {workspace.startDate ? (
              <div>
                <span className="font-medium">Start date: </span>
                {new Date(workspace.startDate).toLocaleDateString()}
              </div>
            ) : null}
            {workspace.targetCompletionDate ? (
              <div>
                <span className="font-medium">Target completion: </span>
                {new Date(workspace.targetCompletionDate).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
