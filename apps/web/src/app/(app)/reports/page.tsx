"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconClipboardCheck,
  IconFileText,
  IconHourglass,
  IconPlus,
  IconStack2,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { ExportMenu, useListParams } from "@/components/data";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { DataTableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthContext } from "@/components/providers/auth-provider";
import { DASH_ASSETS } from "@/features/dashboard/components/decor";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { InviteReporterDialog } from "@/features/partner-reports/components/invite-reporter-dialog";
import { ReportsList } from "@/features/partner-reports/components/reports-list";
import {
  downloadPartnerReportsCsv,
  useMyReportingStatus,
  usePartnerReportDashboard,
  usePartnerReportsList,
} from "@/features/partner-reports/hooks/use-partner-reports";

type ListTab = "awaiting" | "all" | "mine";

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function ReportsInner() {
  const router = useRouter();
  const { can, user } = useAuthContext();
  const canSeeAll = can("partner-report:view-all");
  const canInvite = can("partner-report:invite");
  const canSubmit = can("partner-report:submit");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { params, setParams, queryString } = useListParams({ pageSize: 20 });
  const tab =
    (params.extra.tab as ListTab) || (canSeeAll ? "awaiting" : "mine");

  const listQuery = useMemo(() => {
    const sp = new URLSearchParams(queryString);
    sp.delete("tab");
    if (tab === "awaiting" && canSeeAll) sp.set("status", "Submitted");
    else if (sp.get("status") === "Submitted" && tab !== "awaiting")
      sp.delete("status");
    return sp.toString();
  }, [queryString, tab, canSeeAll]);

  const reports = usePartnerReportsList(listQuery);
  const dashboard = usePartnerReportDashboard(canSeeAll);
  const myStatus = useMyReportingStatus(canSubmit && !canSeeAll);

  const rows = useMemo(() => {
    const data = reports.data?.data ?? [];
    if (tab === "mine" && canSeeAll && user?.id) {
      return data.filter((r) => r.submittedById === user.id);
    }
    return data;
  }, [reports.data?.data, tab, canSeeAll, user?.id]);

  async function exportList() {
    setExporting(true);
    try {
      const q = listQuery ? `?${listQuery}` : "";
      await downloadPartnerReportsCsv(
        `partner-reports/export${q}`,
        "reports.csv",
      );
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const showRequestBanner =
    canSubmit &&
    myStatus.data &&
    (myStatus.data.expectation === "requested" ||
      myStatus.data.expectation === "due");

  return (
    <div className="w-full min-w-0 space-y-5">
      <PageToolbar
        title="Reports"
        description={
          canSeeAll
            ? "Review submissions, manage reporters, and export anytime"
            : "Draft and submit reports to the Principal — anytime, not only on schedule"
        }
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Reports" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canSeeAll ? (
              <ExportMenu
                label={exporting ? "Exporting…" : "Export"}
                disabled={exporting}
                onExportCsv={() => void exportList()}
              />
            ) : null}
            {canInvite ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(true)}
              >
                <IconUsers className="size-4" />
                Roster
              </Button>
            ) : null}
            {canSubmit ? (
              <Button type="button" onClick={() => router.push("/reports/new")}>
                <IconPlus className="size-4" />
                New report
              </Button>
            ) : null}
          </div>
        }
      />

      {showRequestBanner ? (
        <div className="relative overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-background to-background px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-xl space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {myStatus.data?.expectation === "requested"
                  ? "The Principal requested a report"
                  : "A report is due for your cadence"}
              </p>
              <p className="text-sm text-muted-foreground">
                {myStatus.data?.requestNote ||
                  "You can submit now, or any time — the schedule is a guide, not a lock."}
              </p>
            </div>
            <Button type="button" onClick={() => router.push("/reports/new")}>
              Start report
            </Button>
          </div>
        </div>
      ) : null}

      {canSeeAll && dashboard.data ? (
        <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <StatCard
            label="Awaiting review"
            value={dashboard.data.awaitingReview}
            hint="Submitted to you"
            icon={IconHourglass}
            tone="amber"
            href="/reports?tab=awaiting"
            illustration={DASH_ASSETS.easy.underReview}
          />
          <StatCard
            label="Reviewed"
            value={dashboard.data.reviewed}
            hint="Closed cycles"
            icon={IconClipboardCheck}
            tone="green"
            illustration={DASH_ASSETS.easy.accepted}
          />
          <StatCard
            label="Drafts"
            value={dashboard.data.drafts}
            hint="In progress"
            icon={IconFileText}
            tone="sky"
            illustration={DASH_ASSETS.easy.documents}
            illustrationDark={DASH_ASSETS.easy.documentsDark}
          />
          <StatCard
            label="Total"
            value={dashboard.data.total}
            hint="All time"
            icon={IconStack2}
            tone="slate"
            illustration={DASH_ASSETS.folder}
            illustrationDark={DASH_ASSETS.folderDark}
          />
        </div>
      ) : null}

      {!canSeeAll && canSubmit ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card px-4 py-3.5">
          <div className="relative z-[1] max-w-[85%]">
            <p className="text-sm font-medium">Your reporting rhythm</p>
            <p className="text-xs text-muted-foreground">
              {myStatus.data?.cadence && myStatus.data.cadence !== "None"
                ? `Preferred: ${myStatus.data.cadence.toLowerCase()} · last submitted ${formatWhen(myStatus.data.lastSubmittedAt)}`
                : "Ad hoc — submit whenever you have an update"}
            </p>
          </div>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams({ page: 1, extra: { ...params.extra, tab: value } })
        }
      >
        <TabsList className="h-auto w-full min-w-0 flex-wrap justify-start">
          {canSeeAll ? (
            <TabsTrigger value="awaiting">Awaiting review</TabsTrigger>
          ) : null}
          {canSeeAll ? (
            <TabsTrigger value="all">All reports</TabsTrigger>
          ) : null}
          <TabsTrigger value="mine">My reports</TabsTrigger>
        </TabsList>
      </Tabs>

      <ReportsList
        rows={rows}
        meta={tab === "mine" && canSeeAll ? undefined : reports.data?.meta}
        pageSize={params.pageSize}
        isPending={reports.isPending || reports.isFetching}
        error={reports.isError ? "Failed to load reports" : null}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(row) => router.push(`/reports/${row.id}`)}
        emptyMessage={
          canSubmit
            ? "No reports yet — create one whenever you are ready"
            : "No reports yet"
        }
      />

      {canInvite ? (
        <InviteReporterDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <ReportsInner />
    </Suspense>
  );
}
