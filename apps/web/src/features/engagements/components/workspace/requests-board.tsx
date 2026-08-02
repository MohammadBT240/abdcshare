'use client';

import { useState, useMemo } from 'react';
import { IconPlus, IconAlertCircle, IconClock, IconUser } from '@tabler/icons-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { UserAvatar } from '@/components/data/user-avatar';
import { CreateRequestDialog } from '@/features/requests/components/create-request-dialog';
import { useRequestsList } from '@/features/requests/hooks/use-requests';
import type { EngagementWorkspace } from '@/features/engagements/hooks/use-engagements';

interface RequestsBoardProps {
  workspace: EngagementWorkspace;
  canCreateRequest: boolean;
}

export function RequestsBoard({ workspace, canCreateRequest }: RequestsBoardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activePhase, setActivePhase] = useState<'All' | 'Planning' | 'Execution' | 'Reporting'>('All');

  const requests = useRequestsList(`engagementId=${workspace.id}&pageSize=100`);

  const requestsByPhaseAndClass = useMemo(() => {
    const data = requests.data?.data ?? [];
    const grouped: Record<string, Record<string, typeof data>> = {
      All: {},
      Planning: {},
      Execution: {},
      Reporting: {},
    };

    data.forEach((req) => {
      const className = req.requestClassName;
      if (!grouped.All![className]) grouped.All![className] = [];
      grouped.All![className]!.push(req);

      if (!grouped[req.phase]![className]) grouped[req.phase]![className] = [];
      grouped[req.phase]![className]!.push(req);
    });

    return grouped;
  }, [requests.data]);

  const currentPhaseData = requestsByPhaseAndClass[activePhase] ?? {};

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Requests</CardTitle>
              <CardDescription>
                {workspace.requestCount} total • {workspace.overdueCount} overdue
              </CardDescription>
            </div>
            {canCreateRequest ? (
              <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                <IconPlus className="mr-2 h-4 w-4" />
                Create request
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activePhase} onValueChange={(v) => setActivePhase(v as typeof activePhase)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="All">
                All <Badge variant="secondary" className="ml-2">{requests.data?.data.length ?? 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="Planning">
                Planning <Badge variant="secondary" className="ml-2">{workspace.phaseCounts.Planning}</Badge>
              </TabsTrigger>
              <TabsTrigger value="Execution">
                Execution <Badge variant="secondary" className="ml-2">{workspace.phaseCounts.Execution}</Badge>
              </TabsTrigger>
              <TabsTrigger value="Reporting">
                Reporting <Badge variant="secondary" className="ml-2">{workspace.phaseCounts.Reporting}</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {requests.isPending ? (
                <p className="text-sm text-muted-foreground">Loading requests...</p>
              ) : Object.keys(currentPhaseData).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No requests in this phase yet
                </p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {Object.entries(currentPhaseData).map(([className, classRequests]) => (
                    <AccordionItem
                      key={className}
                      value={className}
                      className="rounded-md border"
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex flex-1 items-center justify-between pr-4">
                          <span className="font-medium">{className}</span>
                          <Badge variant="secondary">{classRequests.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3">
                        <div className="space-y-2">
                          {classRequests.map((req) => (
                            <div
                              key={req.id}
                              className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm"
                            >
                              <div className="flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="font-medium">{req.referenceCode}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {req.requestTypeName}
                                  </Badge>
                                  {req.isOverdue ? (
                                    <Badge variant="destructive" className="text-xs">
                                      <IconAlertCircle className="mr-1 h-3 w-3" />
                                      Overdue
                                    </Badge>
                                  ) : null}
                                </div>
                                {req.description ? (
                                  <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                                    {req.description}
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">Stage:</span>
                                    <span>{req.stage}</span>
                                  </div>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">Status:</span>
                                    <span>{req.status}</span>
                                  </div>
                                  {req.dueDate ? (
                                    <>
                                      <span>•</span>
                                      <div className="flex items-center gap-1">
                                        <IconClock className="h-3 w-3" />
                                        {new Date(req.dueDate).toLocaleDateString()}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              {req.assignees.length > 0 ? (
                                <div className="flex -space-x-2">
                                  {req.assignees.slice(0, 3).map((assignee) => (
                            <UserAvatar
                              key={assignee.userId}
                              src={assignee.avatarUrl}
                              initials={assignee.fullName.slice(0, 2)}
                              size="sm"
                              className="ring-2 ring-background"
                            />
                                  ))}
                                  {req.assignees.length > 3 ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                                      +{req.assignees.length - 3}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <CreateRequestDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        engagementId={workspace.id}
        engagementTitle={workspace.title}
        workingPhase={
          workspace.stage !== 'Completed' && workspace.stage !== 'Archived'
            ? workspace.stage
            : undefined
        }
        inScopeClasses={(workspace.classRollups ?? []).map((r) => ({
          id: r.requestClassId,
          name: r.name,
        }))}
        teamMembers={workspace.team ?? []}
      />
    </>
  );
}
