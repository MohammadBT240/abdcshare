"use client";

import { Suspense, use, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconBuilding,
  IconHistory,
  IconLayoutDashboard,
  IconMessageCircle,
  IconFiles,
  IconNotebook,
} from "@tabler/icons-react";
import { UserAvatar } from "@/components/data/user-avatar";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { AppTabNav } from "@/components/layout/app-tab-nav";
import { useAuthContext } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/forms";
import { toast } from "sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { RequestDiscussionTab } from "@/features/discussions/components/request-discussion-tab";
import { useEngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import { STAGE_STYLES } from "@/features/engagements/lib/stage-styles";
import { RequestHistoryList } from "@/features/requests/components/request-history-list";
import {
  ManageAssigneesDialog,
  RequestLinkedWorkingPapersTab,
  RequestOverviewTab,
} from "@/features/requests/components/request-overview-tab";
import { useDeleteRequest, useRequest } from "@/features/requests/hooks/use-requests";
import { RequestSubmissionsTab } from "@/features/submissions/components/request-submissions-tab";
import {
  REQUEST_DETAIL_TABS,
  parseRequestDetailTab,
  type RequestDetailTab,
} from "@/features/requests/lib/request-tabs";
import { BffClientError } from "@/lib/bff/client";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<RequestDetailTab, ReactNode> = {
  overview: <IconLayoutDashboard />,
  discussion: <IconMessageCircle />,
  submissions: <IconFiles />,
  "working-papers": <IconNotebook />,
  history: <IconHistory />,
};

interface RequestDetailPageProps {
  params: Promise<{ id: string }>;
}

function RequestDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, user } = useAuthContext();
  const request = useRequest(id);
  const remove = useDeleteRequest(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const workspace = useEngagementWorkspace(request.data?.engagementId ?? "");

  /** Edit / stage / status / delete — Super Admin. */
  const canManageRequest = can("request:update") && can("catalogue:view");
  /** Assignees — Super Admin. */
  const canManageAssignees = can("request:assign") && can("catalogue:view");
  /** Linked working papers tab — not for Client (no document:view). */
  const canViewLinkedWorkingPapers = can("document:view");
  const canSubmitReview = can("review:submit");
  const canParticipateInDiscussion = can("discussion:participate");
  const canRespond = can("submission:respond");
  const canReview = can("submission:review");

  const requestedTab = parseRequestDetailTab(searchParams.get("tab"));
  const activeTab =
    requestedTab === "working-papers" && !canViewLinkedWorkingPapers
      ? "overview"
      : requestedTab;

  const visibleTabs = REQUEST_DETAIL_TABS.filter(
    (t) => t.id !== "working-papers" || canViewLinkedWorkingPapers,
  );

  function setTab(tab: RequestDetailTab) {
    if (tab === "working-papers" && !canViewLinkedWorkingPapers) return;
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function deleteRequest() {
    try {
      await remove.mutateAsync();
      toast.success("Request deleted");
      router.push("/requests");
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : "Failed to delete request");
    }
  }

  const errorMessage = useMemo(() => {
    if (!request.isError) return null;
    const err = request.error;
    if (err instanceof BffClientError) {
      if (err.statusCode === 404) return "Request not found";
      if (err.statusCode === 403)
        return "You do not have permission to view this request";
      return err.message;
    }
    return "Failed to load request";
  }, [request.isError, request.error]);

  if (request.isPending) {
    return (
      <div className="space-y-5">
        <PageToolbar
          title="Loading..."
          breadcrumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "Requests", href: "/requests" },
          ]}
        />
        <p className="text-sm text-muted-foreground">Loading request…</p>
      </div>
    );
  }

  if (errorMessage || !request.data) {
    return (
      <div className="space-y-5">
        <PageToolbar
          title="Request"
          breadcrumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "Requests", href: "/requests" },
          ]}
        />
        <p className="text-sm text-destructive">
          {errorMessage ?? "Request not found"}
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href="/requests">Back to requests</Link>
        </Button>
      </div>
    );
  }

  const r = request.data;
  const engagementHref = `/engagements/${r.engagementId}?tab=requests`;
  const clientName = r.clientName || workspace.data?.clientName || "";
  const clientId = r.clientId || workspace.data?.clientId || "";
  const departmentName =
    r.departmentName || workspace.data?.departmentName || "";
  const engagementTitle = r.engagementTitle || workspace.data?.title || "";
  const phaseStyle = STAGE_STYLES[r.phase] ?? STAGE_STYLES.Planning;

  return (
    <div className="space-y-3">
      <PageToolbar
        variant="compact"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Requests", href: "/requests" },
          { label: r.referenceCode },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={engagementHref}>Engagement</Link>
            </Button>
            {canManageRequest ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      <header className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <Image
          src="/illustrations/easy/9.svg"
          alt=""
          width={140}
          height={140}
          unoptimized
          aria-hidden
          className="pointer-events-none absolute -bottom-3 -right-2 h-28 w-28 select-none object-contain opacity-25 dark:opacity-15"
        />
        <div className="relative z-[1] space-y-3 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconBuilding className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {r.referenceCode}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  {clientName ? (
                    clientId ? (
                      <Link
                        href={`/admin/clients/${clientId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {clientName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">
                        {clientName}
                      </span>
                    )
                  ) : (
                    <span>No client</span>
                  )}
                  {[departmentName, engagementTitle].filter(Boolean).length > 0
                    ? ` · ${[departmentName, engagementTitle].filter(Boolean).join(" · ")}`
                    : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn("border-transparent", phaseStyle.className)}
              >
                {r.phase}
              </Badge>
              {r.stage ? <Badge variant="outline">{r.stage}</Badge> : null}
              {r.status ? <Badge variant="outline">{r.status}</Badge> : null}
              {r.isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
            </div>
          </div>

          {r.description?.trim() ? (
            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {r.description.trim()}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description provided.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assignees
            </span>
            {r.assignees.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                None yet
                {canManageAssignees ? " — use Manage to assign." : "."}
              </span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {r.assignees.map((a) => (
                  <li
                    key={a.userId}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                  >
                    <UserAvatar
                      src={a.avatarUrl}
                      initials={a.fullName.slice(0, 2)}
                      size="sm"
                    />
                    <span className="font-medium">{a.fullName}</span>
                  </li>
                ))}
              </ul>
            )}
            {canManageAssignees ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setAssignOpen(true)}
              >
                Manage
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setTab(v as RequestDetailTab)}
        className="space-y-3"
      >
        <AppTabNav
          items={visibleTabs.map((t) => ({
            ...t,
            icon: TAB_ICONS[t.id],
          }))}
        />

        <TabsContent value="overview" className="mt-0">
          <RequestOverviewTab
            request={{
              ...r,
              clientId: r.clientId || workspace.data?.clientId || "",
              clientName: r.clientName || workspace.data?.clientName || "",
              departmentName:
                r.departmentName || workspace.data?.departmentName || "",
              departmentId:
                r.departmentId || workspace.data?.departmentId || 0,
            }}
            teamMembers={workspace.data?.team ?? []}
            canManageRequest={canManageRequest}
            canManageAssignees={canManageAssignees}
            canSubmitReview={canSubmitReview}
            canRespond={canRespond}
            canReview={canReview}
            onManageAssignees={() => setAssignOpen(true)}
          />
        </TabsContent>

        <TabsContent value="discussion" className="mt-0">
          <RequestDiscussionTab
            requestId={r.id}
            teamMembers={workspace.data?.team ?? []}
            assignees={r.assignees}
            currentUserId={user?.id}
            canParticipate={canParticipateInDiscussion}
            active={activeTab === "discussion"}
          />
        </TabsContent>

        <TabsContent value="submissions" className="mt-0">
          <RequestSubmissionsTab
            requestId={r.id}
            canRespond={canRespond}
            canReview={canReview}
            enabled={activeTab === "submissions"}
          />
        </TabsContent>

        {canViewLinkedWorkingPapers ? (
          <TabsContent value="working-papers" className="mt-0">
            <RequestLinkedWorkingPapersTab
              request={{
                ...r,
                clientId: r.clientId || workspace.data?.clientId || "",
                clientName: r.clientName || workspace.data?.clientName || "",
                departmentName:
                  r.departmentName || workspace.data?.departmentName || "",
                departmentId:
                  r.departmentId || workspace.data?.departmentId || 0,
              }}
              enabled={activeTab === "working-papers"}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="history" className="mt-0">
          <RequestHistoryList
            requestId={r.id}
            enabled={activeTab === "history"}
          />
        </TabsContent>
      </Tabs>
      {canManageAssignees ? (
        <ManageAssigneesDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          request={r}
          teamMembers={workspace.data?.team ?? []}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete request?"
        description="This permanently deletes the request. Requests with submissions or linked documents cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        confirming={remove.isPending}
        onConfirm={deleteRequest}
      />
    </div>
  );
}

export default function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <PageToolbar
            title="Loading..."
            breadcrumbs={[
              { label: "Home", href: "/dashboard" },
              { label: "Requests", href: "/requests" },
            ]}
          />
          <p className="text-sm text-muted-foreground">Loading request…</p>
        </div>
      }
    >
      <RequestDetailInner id={id} />
    </Suspense>
  );
}
