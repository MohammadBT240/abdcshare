'use client';

import { Suspense, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconListDetails,
  IconSettings,
} from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { AppTabNav } from '@/components/layout/app-tab-nav';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useEngagementWorkspace } from '@/features/engagements/hooks/use-engagements';
import { useSupportingDocuments } from '@/features/documents/hooks/use-supporting-documents';
import { EngagementHeader } from '@/features/engagements/components/workspace/engagement-header';
import { buildNextActions } from '@/features/engagements/components/workspace/next-actions';
import { OverviewTab } from '@/features/engagements/components/workspace/overview-tab';
import { WorkTab } from '@/features/engagements/components/workspace/work-tab';
import { AdminTab } from '@/features/engagements/components/workspace/admin-tab';
import { TransitionEngagementDialog } from '@/features/engagements/components/transition-engagement-dialog';
import { CloneEngagementDialog } from '@/features/engagements/components/clone-engagement-dialog';
import { Button } from '@/components/ui/button';
import {
  WORKSPACE_TABS,
  defaultTabForStage,
  parseWorkspaceTab,
  type WorkspaceTab,
} from '@/features/engagements/lib/workspace-tabs';

const WORKSPACE_TAB_ICONS: Record<WorkspaceTab, ReactNode> = {
  overview: <IconLayoutDashboard />,
  requests: <IconListDetails />,
  settings: <IconSettings />,
};

interface EngagementWorkspacePageProps {
  params: Promise<{ id: string }>;
}

function EngagementWorkspaceInner({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, user } = useAuthContext();
  const workspace = useEngagementWorkspace(id);
  const planningDocs = useSupportingDocuments(id);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);

  const canCreateRequest = can('request:create');
  const canDeleteDocument = can('document:delete');
  const canViewDocuments = can('document:view');
  // Prefer workspace-scoped flags (SA global OR Lead on this engagement).
  const canUpdate =
    workspace.data?.canManageEngagement ?? can('engagement:update');
  const canTransition =
    workspace.data?.canTransitionEngagement ?? can('engagement:transition');
  const canSignOff =
    workspace.data?.canSignOffEngagement ?? can('review:signoff');
  const showAdmin = canUpdate || canSignOff || canTransition;

  const tabFromUrl = parseWorkspaceTab(searchParams.get('tab'));
  const classParam = searchParams.get('classId');
  const selectedClassId: number | 'all' =
    classParam && classParam !== 'all' && !Number.isNaN(Number(classParam))
      ? Number(classParam)
      : 'all';

  const defaultTab = workspace.data
    ? defaultTabForStage(workspace.data.stage)
    : 'overview';
  const activeTab: WorkspaceTab =
    tabFromUrl && (tabFromUrl !== 'settings' || showAdmin) ? tabFromUrl : defaultTab;

  function setQuery(patch: { tab?: WorkspaceTab; classId?: number | 'all' }) {
    const next = new URLSearchParams(searchParams.toString());
    if (patch.tab) next.set('tab', patch.tab);
    if (patch.classId !== undefined) {
      if (patch.classId === 'all') next.delete('classId');
      else next.set('classId', String(patch.classId));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!workspace.data) return;
    if (!tabFromUrl) {
      setQuery({ tab: defaultTabForStage(workspace.data.stage) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed tab when missing
  }, [workspace.data?.id, workspace.data?.stage]);

  const nextActions = useMemo(() => {
    if (!workspace.data) return [];
    return buildNextActions({
      workspace: workspace.data,
      planningDocCount: planningDocs.data?.data?.length ?? 0,
      canUpdate,
      canSignOff,
      canTransition,
      onTransition: () => setTransitionOpen(true),
    });
  }, [workspace.data, planningDocs.data, canUpdate, canSignOff, canTransition]);

  if (workspace.isPending) {
    return (
      <div className="space-y-3">
        <PageToolbar
          variant="compact"
          breadcrumbs={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Engagements', href: '/engagements' },
          ]}
        />
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  if (workspace.isError || !workspace.data) {
    return (
      <div className="space-y-3">
        <PageToolbar
          variant="compact"
          breadcrumbs={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Engagements', href: '/engagements' },
          ]}
        />
        <p className="text-sm text-destructive">Failed to load engagement workspace</p>
      </div>
    );
  }

  const ws = workspace.data;
  const visibleTabs = WORKSPACE_TABS.filter((t) => t.id !== 'settings' || showAdmin);

  return (
    <div className="space-y-3">
      <PageToolbar
        variant="compact"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Engagements', href: '/engagements' },
          { label: ws.referenceCode },
        ]}
        actions={
          can('engagement:create') ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
              Clone for new period
            </Button>
          ) : null
        }
      />

      <EngagementHeader
        workspace={ws}
        onTransition={() => setTransitionOpen(true)}
        canTransition={canTransition}
        canViewDocuments={canViewDocuments}
        nextActions={nextActions}
        onSelectTab={(tab) => setQuery({ tab })}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setQuery({ tab: v as WorkspaceTab })}
        className="space-y-3"
      >
        <AppTabNav
          items={visibleTabs.map((t) => ({
            ...t,
            icon: WORKSPACE_TAB_ICONS[t.id],
          }))}
        />

        <TabsContent value="overview" className="mt-0 outline-none">
          <OverviewTab
            workspace={ws}
            canUpload={canUpdate}
            canDelete={canDeleteDocument}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-0 outline-none">
          <WorkTab
            workspace={ws}
            canCreateRequest={canCreateRequest}
            canManageClasses={canUpdate}
            selectedClassId={selectedClassId}
            onSelectClass={(classId) => setQuery({ tab: 'requests', classId })}
            onGoAdmin={() => setQuery({ tab: 'settings' })}
          />
        </TabsContent>

        {showAdmin ? (
          <TabsContent value="settings" className="mt-0 outline-none">
            <AdminTab
              workspace={ws}
              canUpdate={canUpdate}
              canSignOff={canSignOff}
              currentUserId={user?.id}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      {canTransition && ws.allowedNextStages.length > 0 ? (
        <TransitionEngagementDialog
          open={transitionOpen}
          onOpenChange={setTransitionOpen}
          workspace={ws}
        />
      ) : null}
      <CloneEngagementDialog
        engagementId={ws.id}
        sourcePeriodLabel={ws.periodLabel}
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={(cloneId) => router.push(`/engagements/${cloneId}`)}
      />
    </div>
  );
}

export default function EngagementWorkspacePage({ params }: EngagementWorkspacePageProps) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="space-y-5 p-1">
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      }
    >
      <EngagementWorkspaceInner id={id} />
    </Suspense>
  );
}
