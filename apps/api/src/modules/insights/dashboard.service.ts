import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { DocumentCategory, EngagementStage, ReportReviewState } from '@abdcshare/shared';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { NotificationEntity } from '../notifications/infrastructure/persistence/notification.entity';

export interface DashboardSummary {
  engagements: { total: number; byStage: Record<string, number> };
  requests: { inScope: number; overdue: number; assignedToMe: number };
  finalReports: { awaitingClientReview: number };
  notifications: { unread: number };
}

/** Role/scope-aware headline numbers for the caller's home dashboard. */
@Injectable()
export class DashboardService {
  constructor(private readonly em: EntityManager) {}

  async summary(user: AuthenticatedUser): Promise<DashboardSummary> {
    const scope = resolveScope(user);
    const eng = engagementScopeWhere(scope);
    const engWhere = eng as FilterQuery<EngagementEntity>;
    const reqEng = Object.keys(eng).length ? { engagement: eng } : {};

    const byStage: Record<string, number> = {};
    for (const s of Object.values(EngagementStage)) {
      byStage[s] = await this.em.count(EngagementEntity, { stage: s, ...eng } as FilterQuery<EngagementEntity>);
    }

    const [total, inScope, overdue, assignedToMe, awaitingClientReview, unread] = await Promise.all([
      this.em.count(EngagementEntity, engWhere),
      this.em.count(RequestEntity, reqEng as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, { ...reqEng, dueDate: { $lt: new Date() } } as FilterQuery<RequestEntity>),
      this.em.count(RequestEntity, { assignees: { user: user.userId } } as FilterQuery<RequestEntity>),
      this.em.count(DocumentEntity, {
        category: DocumentCategory.FinalReport,
        clientReviewState: ReportReviewState.AwaitingClient,
        ...eng,
      } as FilterQuery<DocumentEntity>),
      this.em.count(NotificationEntity, { user: user.userId, isRead: false } as FilterQuery<NotificationEntity>),
    ]);

    return {
      engagements: { total, byStage },
      requests: { inScope, overdue, assignedToMe },
      finalReports: { awaitingClientReview },
      notifications: { unread },
    };
  }
}
