import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  DocumentCategory,
  DocumentStatus,
  EVENT,
  MAX_REPORT_REVIEW_ROUNDS,
  ReportReviewDecision,
  ReportReviewState,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { DocumentFileEntity } from '../documents/infrastructure/persistence/document-file.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { ReportReviewCycleEntity } from './infrastructure/persistence/report-review-cycle.entity';
import type {
  OverrideReportDto,
  PendingReportListQueryDto,
  RespondReportDto,
} from './presentation/dto/report-review.dto';
import { ClientPendingReportDto, ReportReviewStatusDto } from './presentation/dto/report-review.dto';

@Injectable()
export class ReportReviewsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** A final-report document under the caller's access scope. */
  private finalReportWhere(id: string, user: AuthenticatedUser): FilterQuery<DocumentEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    const base: Record<string, unknown> = { id, category: DocumentCategory.FinalReport };
    if (Object.keys(eng).length) base.engagement = eng;
    return base as FilterQuery<DocumentEntity>;
  }

  private async load(id: string, user: AuthenticatedUser, populate?: string[]): Promise<DocumentEntity> {
    const doc = await this.em.findOne(
      DocumentEntity,
      this.finalReportWhere(id, user),
      populate ? { populate: populate as never } : undefined,
    );
    if (!doc) throw new NotFoundException('Final report not found');
    return doc;
  }

  private async cyclesFor(documentId: string): Promise<ReportReviewCycleEntity[]> {
    return this.em.find(
      ReportReviewCycleEntity,
      { document: documentId } as FilterQuery<ReportReviewCycleEntity>,
      { orderBy: { roundNo: 'asc' } },
    );
  }

  private async toStatus(doc: DocumentEntity): Promise<ReportReviewStatusDto> {
    const cycles = await this.cyclesFor(doc.id);
    return {
      documentId: doc.id,
      engagementId: doc.engagement.id,
      title: doc.title,
      documentStatus: doc.status,
      reviewState: doc.clientReviewState,
      reviewRound: doc.clientReviewRound,
      maxRounds: MAX_REPORT_REVIEW_ROUNDS,
      currentVersion: doc.currentVersion,
      cycles: cycles.map((c) => ({
        id: c.id,
        roundNo: c.roundNo,
        fileVersion: c.fileVersion,
        decision: c.decision,
        sentAt: c.sentAt,
        decidedAt: c.decidedAt ?? null,
        feedback: c.feedback ?? null,
      })),
    };
  }

  private firmRecipients(doc: DocumentEntity): NotifyRecipient[] {
    return doc.engagement.team.getItems().map((tm) => ({ userId: tm.user.id, email: tm.user.email ?? null }));
  }

  private clientRecipient(doc: DocumentEntity): NotifyRecipient[] {
    const c = doc.engagement.client?.primaryContact;
    return c ? [{ userId: c.id, email: c.email ?? null }] : [];
  }

  // ---- SA: send draft to client -------------------------------------------

  async sendToClient(documentId: string, user: AuthenticatedUser): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ['engagement.client.primaryContact']);
    if (doc.currentVersion < 1) {
      throw new BadRequestException('Upload a report file before sending it to the client');
    }
    if (doc.clientReviewState === ReportReviewState.AwaitingClient) {
      throw new ConflictException('This report is already awaiting the client');
    }
    if (doc.clientReviewState === ReportReviewState.Locked) {
      throw new BadRequestException('This report is locked after 3 cycles — use override to finalise');
    }
    if (
      doc.clientReviewState === ReportReviewState.Approved ||
      doc.clientReviewState === ReportReviewState.Overridden
    ) {
      throw new BadRequestException('This report is already finalised');
    }
    if (doc.clientReviewRound >= MAX_REPORT_REVIEW_ROUNDS) {
      throw new BadRequestException('Maximum review cycles reached');
    }

    const round = doc.clientReviewRound + 1;
    this.em.create(ReportReviewCycleEntity, {
      document: doc,
      roundNo: round,
      fileVersion: doc.currentVersion,
      sentBy: this.em.getReference(UserEntity, user.userId),
      sentAt: new Date(),
      decision: ReportReviewDecision.Pending,
    });
    doc.clientReviewRound = round;
    doc.clientReviewState = ReportReviewState.AwaitingClient;

    await this.notifications.emit({
      recipients: this.clientRecipient(doc),
      type: 'report.review_requested',
      title: 'A final report draft is ready for your review',
      body: `Round ${round} of ${MAX_REPORT_REVIEW_ROUNDS}: please review and approve or request changes.`,
      entityType: 'document',
      entityId: doc.id,
      link: `/final-reports/${doc.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.ReportSentForReview, { documentId: doc.id, round });
    await this.em.flush();
    return this.toStatus(doc);
  }

  // ---- SA: override a locked report ---------------------------------------

  async override(
    documentId: string,
    dto: OverrideReportDto,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ['engagement.client.primaryContact']);
    if (doc.clientReviewState !== ReportReviewState.Locked) {
      throw new BadRequestException('Only a locked report can be overridden');
    }
    doc.clientReviewState = ReportReviewState.Overridden;
    doc.status = DocumentStatus.SignedOff; // finalised / issued
    await this.notifications.emit({
      recipients: this.clientRecipient(doc),
      type: 'report.finalised',
      title: 'A final report has been issued',
      body: dto.reason,
      entityType: 'document',
      entityId: doc.id,
      link: `/final-reports/${doc.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.ReportReviewDecided, { documentId: doc.id, outcome: 'overridden' });
    await this.em.flush();
    return this.toStatus(doc);
  }

  async statusForFirm(documentId: string, user: AuthenticatedUser): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ['engagement']);
    return this.toStatus(doc);
  }

  // ---- Client: view / respond ---------------------------------------------

  async listPendingForClient(
    user: AuthenticatedUser,
    query: PendingReportListQueryDto,
  ): Promise<Paginated<ClientPendingReportDto>> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where: Record<string, unknown> = {
      category: DocumentCategory.FinalReport,
      clientReviewState: ReportReviewState.AwaitingClient,
    };
    if (Object.keys(eng).length) where.engagement = eng;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(DocumentEntity, where as FilterQuery<DocumentEntity>, {
      populate: ['engagement'],
      orderBy: { updatedAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    const data = rows.map((d) => ({
      documentId: d.id,
      engagementId: d.engagement.id,
      title: d.title,
      reviewState: d.clientReviewState,
      reviewRound: d.clientReviewRound,
      currentVersion: d.currentVersion,
    }));
    return paginated(data, total, page, pageSize);
  }

  async getForClient(documentId: string, user: AuthenticatedUser): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ['engagement']);
    if (doc.clientReviewState === ReportReviewState.NotSent) {
      throw new NotFoundException('Final report not found');
    }
    return this.toStatus(doc);
  }

  async downloadForClient(documentId: string, user: AuthenticatedUser): Promise<{ url: string }> {
    const doc = await this.load(documentId, user);
    if (doc.clientReviewState === ReportReviewState.NotSent) {
      throw new NotFoundException('Final report not found');
    }
    const [file] = await this.em.find(
      DocumentFileEntity,
      { document: documentId } as FilterQuery<DocumentFileEntity>,
      { orderBy: { version: 'desc' }, limit: 1 },
    );
    if (!file) throw new NotFoundException('No report file to download');
    const url = await this.storage.presignDownload(file.storageKey, file.fileName);
    return { url };
  }

  async respond(
    documentId: string,
    dto: RespondReportDto,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    if (dto.decision === ReportReviewDecision.ChangesRequested && !dto.feedback) {
      throw new BadRequestException('Feedback is required when requesting changes');
    }
    const doc = await this.load(documentId, user, ['engagement.team.user']);
    if (doc.clientReviewState !== ReportReviewState.AwaitingClient) {
      throw new BadRequestException('This report is not awaiting your review');
    }
    const cycle = await this.em.findOne(ReportReviewCycleEntity, {
      document: documentId,
      roundNo: doc.clientReviewRound,
      decision: ReportReviewDecision.Pending,
    } as FilterQuery<ReportReviewCycleEntity>);
    if (!cycle) throw new BadRequestException('No open review cycle to respond to');

    cycle.decision = dto.decision;
    cycle.decidedBy = this.em.getReference(UserEntity, user.userId);
    cycle.decidedAt = new Date();
    cycle.feedback = dto.feedback ?? null;

    let title: string;
    if (dto.decision === ReportReviewDecision.Approved) {
      doc.clientReviewState = ReportReviewState.Approved;
      doc.status = DocumentStatus.SignedOff; // client approval finalises/issues the report
      title = 'The client approved the final report';
    } else if (doc.clientReviewRound >= MAX_REPORT_REVIEW_ROUNDS) {
      doc.clientReviewState = ReportReviewState.Locked; // 3rd cycle without approval → lock
      title = 'The final report is locked after 3 cycles — override required';
    } else {
      doc.clientReviewState = ReportReviewState.ChangesRequested;
      title = 'The client requested changes to the final report';
    }

    await this.notifications.emit({
      recipients: this.firmRecipients(doc),
      type: 'report.review_decided',
      title,
      body: dto.feedback,
      entityType: 'document',
      entityId: doc.id,
      link: `/documents/${doc.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.ReportReviewDecided, {
      documentId: doc.id,
      round: doc.clientReviewRound,
      decision: dto.decision,
    });
    await this.em.flush();
    return this.toStatus(doc);
  }
}
