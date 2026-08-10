import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  DocumentCategory,
  EngagementStage,
  isRequestDone,
  isRequestOverdue,
  PartnerReportStatus,
  ReportReviewState,
  ReviewStatus,
  ROLE_NAMES,
  startOfLocalDay,
  statusProgressPercent,
  SubmissionStatus,
} from '@abdcshare/shared';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { NotificationEntity } from '../notifications/infrastructure/persistence/notification.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RequestTypeEntity } from '../request-types/infrastructure/persistence/request-type.entity';
import { RequestStageEntity } from '../request-stages/infrastructure/persistence/request-stage.entity';
import { RequestStatusEntity } from '../request-statuses/infrastructure/persistence/request-status.entity';
import { EngagementTypeEntity } from '../engagement-types/infrastructure/persistence/engagement-type.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { ActivityLogEntity } from '../audit/infrastructure/persistence/activity-log.entity';
import { ClientSubmissionEntity } from '../submissions/infrastructure/persistence/client-submission.entity';
import { ReviewEntity } from '../reviews/infrastructure/persistence/review.entity';
import { PartnerReportEntity } from '../partner-reports/infrastructure/persistence/partner-report.entity';
import { PartnerReportsService } from '../partner-reports/partner-reports.service';
import type {
  AttentionItem,
  ClientDashboard,
  DashboardSummary,
  FirmDashboard,
  GovernanceDashboard,
  GuestDashboard,
  PartnerStrip,
  StaffDashboard,
} from './dashboard.types';

export type { DashboardSummary } from './dashboard.types';

const DONE_STATUSES = ['Accepted', 'Closed'] as const;
const OPEN_STATUS = { name: { $nin: [...DONE_STATUSES] } };

/** Role/scope-aware home dashboard for the caller. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly em: EntityManager,
    private readonly partnerReports: PartnerReportsService,
  ) {}

  async summary(user: AuthenticatedUser): Promise<DashboardSummary> {
    const unread = await this.em.count(NotificationEntity, {
      user: user.userId,
      isRead: false,
    } as FilterQuery<NotificationEntity>);

    if (user.role === 'Platform Admin') {
      return this.governance(user, unread);
    }
    if (user.role === 'Guest') {
      return this.guest(user, unread);
    }
    if (user.role === 'Client') {
      return this.client(user, unread);
    }
    if (user.role === 'Staff') {
      return this.staff(user, unread);
    }
    // Super Admin (and any unexpected ops role) → firm
    return this.firm(user, unread);
  }

  private async governance(
    _user: AuthenticatedUser,
    unread: number,
  ): Promise<GovernanceDashboard> {
    const byRole: Record<string, number> = {};
    await Promise.all(
      ROLE_NAMES.map(async (roleName) => {
        byRole[roleName] = await this.em.count(UserEntity, {
          role: { roleName },
        } as FilterQuery<UserEntity>);
      }),
    );
    const [
      total,
      inactive,
      mustChangePassword,
      requestTypes,
      requestStages,
      requestStatuses,
      engagementTypes,
      departments,
      last7Days,
    ] = await Promise.all([
      this.em.count(UserEntity, {}),
      this.em.count(UserEntity, { isActive: false }),
      this.em.count(UserEntity, { mustChangePassword: true, isActive: true }),
      this.em.count(RequestTypeEntity, {}),
      this.em.count(RequestStageEntity, {}),
      this.em.count(RequestStatusEntity, {}),
      this.em.count(EngagementTypeEntity, {}),
      this.em.count(DepartmentEntity, {}),
      this.em.count(ActivityLogEntity, {
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      } as FilterQuery<ActivityLogEntity>),
    ]);

    const auditRows = await this.em.find(
      ActivityLogEntity,
      {
        createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      } as FilterQuery<ActivityLogEntity>,
      { orderBy: { createdAt: 'ASC' } },
    );
    const startToday = startOfLocalDay(new Date());
    const auditTrend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(startToday);
      d.setDate(d.getDate() - (13 - i));
      return {
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        value: 0,
      };
    });
    for (const row of auditRows) {
      const key = startOfLocalDay(row.createdAt).toISOString().slice(0, 10);
      const bucket = auditTrend.find((b) => b.date === key);
      if (bucket) bucket.value += 1;
    }

    const emptySignals: string[] = [];
    if (requestTypes === 0) emptySignals.push('requestTypes');
    if (requestStages === 0) emptySignals.push('requestStages');
    if (requestStatuses === 0) emptySignals.push('requestStatuses');
    if (engagementTypes === 0) emptySignals.push('engagementTypes');
    if (departments === 0) emptySignals.push('departments');

    const attention: AttentionItem[] = [];
    if (mustChangePassword > 0) {
      attention.push({
        id: 'must-change-password',
        title: `${mustChangePassword} user(s) still need to change password`,
        href: '/admin/users',
        severity: 'warning',
      });
    }
    if (inactive > 0) {
      attention.push({
        id: 'inactive-users',
        title: `${inactive} inactive user(s)`,
        href: '/admin/users',
        severity: 'info',
      });
    }
    for (const signal of emptySignals) {
      attention.push({
        id: `empty-${signal}`,
        title: `Catalogue gap: ${signal} has no rows`,
        href: '/admin/catalogues',
        severity: 'critical',
      });
    }

    return {
      kind: 'governance',
      notifications: { unread },
      attention: attention.slice(0, 8),
      users: { total, byRole, inactive, mustChangePassword },
      catalogue: {
        requestTypes,
        requestStages,
        requestStatuses,
        engagementTypes,
        departments,
        emptySignals,
      },
      audit: { last7Days, trend: auditTrend },
    };
  }

  private async firm(user: AuthenticatedUser, unread: number): Promise<FirmDashboard> {
    const scope = resolveScope(user);
    const eng = engagementScopeWhere(scope);
    const engWhere = eng as FilterQuery<EngagementEntity>;
    const reqEng = Object.keys(eng).length ? { engagement: eng } : {};
    const startOfToday = startOfLocalDay(new Date());
    const endOfSoon = new Date(startOfToday);
    endOfSoon.setDate(endOfSoon.getDate() + 7);

    const byStage: Record<string, number> = {};
    await Promise.all(
      Object.values(EngagementStage).map(async (s) => {
        byStage[s] = await this.em.count(EngagementEntity, {
          stage: s,
          ...eng,
        } as FilterQuery<EngagementEntity>);
      }),
    );

    const [
      total,
      inScope,
      overdue,
      dueSoon,
      awaitingClientReview,
      needsFirmAction,
      openRequests,
    ] = await Promise.all([
      this.em.count(EngagementEntity, engWhere),
      this.em.count(RequestEntity, reqEng as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, {
        ...reqEng,
        dueDate: { $lt: startOfToday },
        status: OPEN_STATUS,
      } as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, {
        ...reqEng,
        dueDate: { $gte: startOfToday, $lte: endOfSoon },
        status: OPEN_STATUS,
      } as FilterQuery<RequestEntity>),
      this.em.count(DocumentEntity, {
        category: DocumentCategory.FinalReport,
        clientReviewState: ReportReviewState.AwaitingClient,
        ...eng,
      } as FilterQuery<DocumentEntity>),
      this.em.count(DocumentEntity, {
        category: DocumentCategory.FinalReport,
        clientReviewState: {
          $in: [ReportReviewState.ChangesRequested, ReportReviewState.Locked],
        },
        ...eng,
      } as FilterQuery<DocumentEntity>),
      this.em.find(
        RequestEntity,
        { ...reqEng, status: OPEN_STATUS } as FilterQuery<RequestEntity>,
        { populate: ['assignees.user'] },
      ),
    ]);

    const unassigned = openRequests.filter((r) => r.assignees.length === 0).length;

    const allRequests = await this.em.find(
      RequestEntity,
      reqEng as FilterQuery<RequestEntity>,
      { populate: ['status'] },
    );
    const progressPercent = statusProgressPercent(
      allRequests.map((r) => ({ statusName: r.status?.name })),
    );
    const done = allRequests.filter((r) => isRequestDone(r.status?.name)).length;
    const open = allRequests.length - done;

    // Weekly created vs completed over the last 8 weeks (completed ≈ done
    // status, bucketed by last update — no dedicated completedAt column).
    const startOfToday2 = startOfLocalDay(new Date());
    const weekStarts: Date[] = [];
    {
      const monday = new Date(startOfToday2);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      for (let i = 7; i >= 0; i--) {
        const w = new Date(monday);
        w.setDate(w.getDate() - i * 7);
        weekStarts.push(w);
      }
    }
    const weekIndex = (d: Date): number => {
      for (let i = weekStarts.length - 1; i >= 0; i--) {
        if (d >= weekStarts[i]!) return i;
      }
      return -1;
    };
    const requestTrend = weekStarts.map((w) => ({
      weekStart: w.toISOString().slice(0, 10),
      label: w.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      created: 0,
      completed: 0,
    }));
    for (const r of allRequests) {
      const ci = weekIndex(r.createdAt);
      if (ci >= 0) requestTrend[ci]!.created += 1;
      if (isRequestDone(r.status?.name)) {
        const di = weekIndex(r.updatedAt);
        if (di >= 0) requestTrend[di]!.completed += 1;
      }
    }

    const submissionsByStatus: Record<string, number> = {};
    await Promise.all(
      Object.values(SubmissionStatus)
        .filter((s) => s !== SubmissionStatus.Draft)
        .map(async (s) => {
          submissionsByStatus[s] = await this.em.count(ClientSubmissionEntity, {
            status: s,
            ...(Object.keys(eng).length ? { request: { engagement: eng } } : {}),
          } as FilterQuery<ClientSubmissionEntity>);
        }),
    );

    const workloadMap = new Map<string, { userId: string; fullName: string; open: number; overdue: number }>();
    for (const r of openRequests) {
      const isOverdue = isRequestOverdue(r.dueDate, undefined);
      for (const a of r.assignees.getItems()) {
        const row = workloadMap.get(a.user.id) ?? {
          userId: a.user.id,
          fullName: a.user.fullName,
          open: 0,
          overdue: 0,
        };
        row.open += 1;
        if (isOverdue) row.overdue += 1;
        workloadMap.set(a.user.id, row);
      }
    }
    const workloadTop = [...workloadMap.values()]
      .sort((a, b) => b.open - a.open || a.fullName.localeCompare(b.fullName))
      .slice(0, 5);

    const attention: AttentionItem[] = [];
    if (overdue > 0) {
      attention.push({
        id: 'overdue-requests',
        title: `${overdue} overdue request(s)`,
        href: '/requests?due=overdue',
        severity: 'critical',
      });
    }
    if (needsFirmAction > 0) {
      attention.push({
        id: 'final-reports-firm',
        title: `${needsFirmAction} final report(s) need firm action`,
        href: '/admin/final-reports',
        severity: 'critical',
      });
    }
    if (dueSoon > 0) {
      attention.push({
        id: 'due-soon',
        title: `${dueSoon} request(s) due within 7 days`,
        href: '/requests?due=next7Days',
        severity: 'warning',
      });
    }
    if (unassigned > 0) {
      attention.push({
        id: 'unassigned',
        title: `${unassigned} open request(s) with no assignee`,
        href: '/requests',
        severity: 'warning',
      });
    }
    if (awaitingClientReview > 0) {
      attention.push({
        id: 'awaiting-client',
        title: `${awaitingClientReview} final report(s) awaiting client`,
        href: '/admin/final-reports',
        severity: 'info',
      });
    }

    const partner = await this.partnerStrip(user);
    if (partner?.mode === 'principal' && partner.awaitingReview > 0) {
      attention.push({
        id: 'partner-awaiting-review',
        title: `${partner.awaitingReview} report(s) awaiting review`,
        href: '/reports?tab=awaiting',
        severity: 'warning',
      });
    }
    if (partner?.mode === 'reporter' && (partner.expectation === 'due' || partner.expectation === 'requested')) {
      attention.push({
        id: 'partner-submit',
        title:
          partner.expectation === 'requested'
            ? 'Principal requested a report'
            : 'Report is due for this period',
        href: '/reports/new',
        severity: partner.expectation === 'requested' ? 'critical' : 'warning',
      });
    }

    return {
      kind: 'firm',
      notifications: { unread },
      attention: attention.slice(0, 8),
      engagements: { total, byStage },
      requests: { inScope, open, done, overdue, dueSoon, unassigned },
      finalReports: { awaitingClientReview, needsFirmAction },
      progressPercent,
      requestTrend,
      submissionsByStatus,
      workloadTop,
      ...(partner ? { partner } : {}),
    };
  }

  private async staff(user: AuthenticatedUser, unread: number): Promise<StaffDashboard> {
    const scope = resolveScope(user);
    const eng = engagementScopeWhere(scope);
    const startOfToday = startOfLocalDay(new Date());
    const endOfSoon = new Date(startOfToday);
    endOfSoon.setDate(endOfSoon.getDate() + 7);

    const mineBase = {
      assignees: { user: user.userId },
      status: OPEN_STATUS,
    };

    const [
      open,
      done,
      overdue,
      dueSoon,
      submissionsAwaitingReview,
      reviewsPendingDecision,
      engagements,
      myOpenRequests,
    ] = await Promise.all([
      this.em.count(RequestEntity, mineBase as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, {
        assignees: { user: user.userId },
        status: { name: { $in: [...DONE_STATUSES] } },
      } as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, {
        ...mineBase,
        dueDate: { $lt: startOfToday },
      } as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, {
        ...mineBase,
        dueDate: { $gte: startOfToday, $lte: endOfSoon },
      } as FilterQuery<RequestEntity>),
      this.em.count(ClientSubmissionEntity, {
        status: SubmissionStatus.Pending,
        request: { engagement: eng },
      } as FilterQuery<ClientSubmissionEntity>),
      this.em.count(ReviewEntity, {
        status: ReviewStatus.ForReview,
        request: { engagement: eng },
      } as FilterQuery<ReviewEntity>),
      this.em.find(EngagementEntity, eng as FilterQuery<EngagementEntity>, {
        orderBy: { updatedAt: 'DESC' },
        limit: 5,
      }),
      this.em.find(RequestEntity, mineBase as FilterQuery<RequestEntity>, {
        populate: ['status', 'engagement'],
        limit: 200,
      }),
    ]);

    const overdueByEng = new Map<string, number>();
    const nearestDueByEng = new Map<string, Date>();
    const dueByDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        value: 0,
      };
    });
    for (const r of myOpenRequests) {
      const engId = r.engagement.id;
      if (isRequestOverdue(r.dueDate, r.status?.name)) {
        overdueByEng.set(engId, (overdueByEng.get(engId) ?? 0) + 1);
      }
      if (r.dueDate && !isRequestDone(r.status?.name)) {
        const due = r.dueDate instanceof Date ? r.dueDate : new Date(r.dueDate);
        const prev = nearestDueByEng.get(engId);
        if (!prev || due < prev) nearestDueByEng.set(engId, due);
        const key = startOfLocalDay(due).toISOString().slice(0, 10);
        const bucket = dueByDay.find((b) => b.date === key);
        if (bucket) bucket.value += 1;
      }
    }

    const myEngagements = engagements.map((e) => ({
      id: e.id,
      title: e.title,
      referenceCode: e.referenceCode,
      overdueCount: overdueByEng.get(e.id) ?? 0,
      nearestDue: nearestDueByEng.get(e.id)?.toISOString().slice(0, 10) ?? null,
    }));

    const attention: AttentionItem[] = [];
    if (overdue > 0) {
      attention.push({
        id: 'my-overdue',
        title: `${overdue} of your request(s) are overdue`,
        href: '/requests?due=overdue',
        severity: 'critical',
      });
    }
    if (dueSoon > 0) {
      attention.push({
        id: 'my-due-soon',
        title: `${dueSoon} assigned request(s) due within 7 days`,
        href: '/requests?due=next7Days',
        severity: 'warning',
      });
    }
    if (submissionsAwaitingReview > 0) {
      attention.push({
        id: 'subs-review',
        title: `${submissionsAwaitingReview} client submission(s) awaiting review`,
        href: '/requests',
        severity: 'warning',
      });
    }
    if (reviewsPendingDecision > 0) {
      attention.push({
        id: 'reviews-pending',
        title: `${reviewsPendingDecision} review(s) pending decision`,
        href: '/reviews',
        severity: 'info',
      });
    }

    const partner = await this.partnerStrip(user);
    if (partner?.mode === 'reporter' && (partner.expectation === 'due' || partner.expectation === 'requested')) {
      attention.push({
        id: 'partner-submit',
        title:
          partner.expectation === 'requested'
            ? 'Principal requested a report'
            : 'Report is due for this period',
        href: '/reports/new',
        severity: partner.expectation === 'requested' ? 'critical' : 'warning',
      });
    }

    return {
      kind: 'staff',
      notifications: { unread },
      attention: attention.slice(0, 8),
      assigned: { open, done, overdue, dueSoon },
      dueByDay,
      myEngagements,
      submissionsAwaitingReview,
      reviewsPendingDecision,
      ...(partner ? { partner } : {}),
    };
  }

  private async client(user: AuthenticatedUser, unread: number): Promise<ClientDashboard> {
    const scope = resolveScope(user);
    const eng = engagementScopeWhere(scope);
    const reqEng = { engagement: eng };

    const submissionsByStatus: Record<string, number> = {};
    await Promise.all(
      Object.values(SubmissionStatus)
        .filter((s) => s !== SubmissionStatus.Draft)
        .map(async (s) => {
          submissionsByStatus[s] = await this.em.count(ClientSubmissionEntity, {
            status: s,
            request: reqEng,
          } as FilterQuery<ClientSubmissionEntity>);
        }),
    );

    const [outstandingRequests, returnedSubmissions, finalReportsAwaitingMe, recentEngagements] =
      await Promise.all([
        this.em.count(RequestEntity, {
          ...reqEng,
          status: { name: 'Pending Client' },
        } as FilterQuery<RequestEntity>),
        this.em.count(ClientSubmissionEntity, {
          status: SubmissionStatus.Returned,
          request: reqEng,
        } as FilterQuery<ClientSubmissionEntity>),
        this.em.count(DocumentEntity, {
          category: DocumentCategory.FinalReport,
          clientReviewState: ReportReviewState.AwaitingClient,
          engagement: eng,
        } as FilterQuery<DocumentEntity>),
        this.em.find(EngagementEntity, eng as FilterQuery<EngagementEntity>, {
          orderBy: { updatedAt: 'DESC' },
          limit: 5,
        }),
      ]);

    const attention: AttentionItem[] = [];
    if (outstandingRequests > 0) {
      attention.push({
        id: 'pending-client',
        title: `${outstandingRequests} request(s) waiting on you`,
        href: '/requests',
        severity: 'critical',
      });
    }
    if (returnedSubmissions > 0) {
      attention.push({
        id: 'returned-subs',
        title: `${returnedSubmissions} submission(s) returned for update`,
        href: '/requests',
        severity: 'warning',
      });
    }
    if (finalReportsAwaitingMe > 0) {
      attention.push({
        id: 'final-reports',
        title: `${finalReportsAwaitingMe} final report(s) awaiting your review`,
        href: '/final-reports',
        severity: 'warning',
      });
    }

    return {
      kind: 'client',
      notifications: { unread },
      attention: attention.slice(0, 8),
      outstandingRequests,
      returnedSubmissions,
      finalReportsAwaitingMe,
      submissionsByStatus,
      recentEngagements: recentEngagements.map((e) => ({
        id: e.id,
        title: e.title,
        referenceCode: e.referenceCode,
        stage: e.stage,
      })),
    };
  }

  private async guest(user: AuthenticatedUser, unread: number): Promise<GuestDashboard> {
    const status = await this.partnerReports.myReportingStatus(user);
    const [drafts, submitted, reviewed] = await Promise.all([
      this.em.count(PartnerReportEntity, {
        submittedBy: user.userId,
        status: PartnerReportStatus.Draft,
      } as FilterQuery<PartnerReportEntity>),
      this.em.count(PartnerReportEntity, {
        submittedBy: user.userId,
        status: PartnerReportStatus.Submitted,
      } as FilterQuery<PartnerReportEntity>),
      this.em.count(PartnerReportEntity, {
        submittedBy: user.userId,
        status: PartnerReportStatus.Reviewed,
      } as FilterQuery<PartnerReportEntity>),
    ]);

    const attention: AttentionItem[] = [];
    if (status.expectation === 'requested' || status.expectation === 'due') {
      attention.push({
        id: 'guest-submit',
        title:
          status.expectation === 'requested'
            ? 'The Principal requested your report'
            : 'Your report is due for this period',
        href: '/reports/new',
        severity: status.expectation === 'requested' ? 'critical' : 'warning',
        meta: status.requestNote ?? undefined,
      });
    }
    if (drafts > 0) {
      attention.push({
        id: 'guest-draft',
        title: `You have ${drafts} draft report(s)`,
        href: '/reports',
        severity: 'info',
      });
    }

    return {
      kind: 'guest',
      notifications: { unread },
      attention: attention.slice(0, 8),
      reporting: {
        canSubmit: status.canSubmit,
        expectation: status.expectation,
        cadence: status.cadence,
        reportRequestedAt: status.reportRequestedAt,
        requestNote: status.requestNote,
        lastSubmittedAt: status.lastSubmittedAt,
        drafts,
        submitted,
        reviewed,
      },
    };
  }

  private async partnerStrip(user: AuthenticatedUser): Promise<PartnerStrip | undefined> {
    if (user.partnerDesignation === 'PrincipalPartner') {
      const d = await this.partnerReports.dashboard();
      return {
        mode: 'principal',
        total: d.total ?? 0,
        drafts: d.drafts ?? 0,
        awaitingReview: d.awaitingReview ?? 0,
        reviewed: d.reviewed ?? 0,
        awaitingDecision: d.awaitingDecision ?? 0,
      };
    }

    if (user.partnerDesignation === 'Partner' || user.role === 'Staff') {
      const status = await this.partnerReports.myReportingStatus(user);
      if (!status.canSubmit) return undefined;
      const [drafts, submitted, reviewed] = await Promise.all([
        this.em.count(PartnerReportEntity, {
          submittedBy: user.userId,
          status: PartnerReportStatus.Draft,
        } as FilterQuery<PartnerReportEntity>),
        this.em.count(PartnerReportEntity, {
          submittedBy: user.userId,
          status: PartnerReportStatus.Submitted,
        } as FilterQuery<PartnerReportEntity>),
        this.em.count(PartnerReportEntity, {
          submittedBy: user.userId,
          status: PartnerReportStatus.Reviewed,
        } as FilterQuery<PartnerReportEntity>),
      ]);
      return {
        mode: 'reporter',
        canSubmit: status.canSubmit,
        expectation: status.expectation,
        cadence: status.cadence,
        reportRequestedAt: status.reportRequestedAt,
        requestNote: status.requestNote,
        lastSubmittedAt: status.lastSubmittedAt,
        drafts,
        submitted,
        reviewed,
      };
    }

    return undefined;
  }
}
