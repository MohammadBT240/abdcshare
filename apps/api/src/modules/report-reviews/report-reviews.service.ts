import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager, type FilterQuery } from "@mikro-orm/postgresql";
import {
  DocumentCategory,
  DocumentStatus,
  EVENT,
  FilePreviewStatus,
  MAX_REPORT_REVIEW_ROUNDS,
  ReportReviewDecision,
  ReportReviewState,
  type Paginated,
} from "@abdcshare/shared";
import { pageParams, paginated } from "../../common/pagination/paginate";
import {
  engagementScopeWhere,
  resolveScope,
} from "../../common/security/access-scope";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";
import { STORAGE, type StoragePort } from "../../common/storage/storage.port";
import {
  extractZipEntryFromSource,
  listZipEntriesFromSource,
  type ZipByteSource,
} from "../../common/storage/zip-entries.util";
import {
  isNativePreviewable,
  isOfficeMime,
  isPreviewAllowlisted,
  isZipMime,
} from "../../common/storage/preview.util";
import { OutboxService } from "../outbox/outbox.service";
import {
  NotificationsService,
  type NotifyRecipient,
} from "../notifications/notifications.service";
import { engagementClientContactRecipients } from "../notifications/recipient-helpers";
import { DocumentEntity } from "../documents/infrastructure/persistence/document.entity";
import { DocumentFileEntity } from "../documents/infrastructure/persistence/document-file.entity";
import { EngagementEntity } from "../engagements/infrastructure/persistence/engagement.entity";
import { UserEntity } from "../users/infrastructure/persistence/user.entity";
import { ReportReviewCycleEntity } from "./infrastructure/persistence/report-review-cycle.entity";
import type {
  FirmReportListQueryDto,
  OverrideReportDto,
  PendingReportListQueryDto,
  ReportFileDto,
  RespondReportDto,
} from "./presentation/dto/report-review.dto";
import {
  ClientPendingReportDto,
  FirmReportListItemDto,
  ReportReviewStatusDto,
} from "./presentation/dto/report-review.dto";

@Injectable()
export class ReportReviewsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** A final-report document under the caller's access scope. */
  private finalReportWhere(
    id: string,
    user: AuthenticatedUser,
  ): FilterQuery<DocumentEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    const base: Record<string, unknown> = {
      id,
      category: DocumentCategory.FinalReport,
    };
    if (Object.keys(eng).length) base.engagement = eng;
    return base as FilterQuery<DocumentEntity>;
  }

  private async load(
    id: string,
    user: AuthenticatedUser,
    populate?: string[],
  ): Promise<DocumentEntity> {
    const doc = await this.em.findOne(
      DocumentEntity,
      this.finalReportWhere(id, user),
      populate ? { populate: populate as never } : undefined,
    );
    if (!doc) throw new NotFoundException("Final report not found");
    return doc;
  }

  private async cyclesFor(
    documentId: string,
  ): Promise<ReportReviewCycleEntity[]> {
    return this.em.find(
      ReportReviewCycleEntity,
      { document: documentId } as FilterQuery<ReportReviewCycleEntity>,
      { orderBy: { roundNo: "asc" } },
    );
  }

  private async filesByVersion(
    documentId: string,
  ): Promise<Map<number, DocumentFileEntity>> {
    const files = await this.em.find(
      DocumentFileEntity,
      { document: documentId } as FilterQuery<DocumentFileEntity>,
      { orderBy: { version: "asc" } },
    );
    return new Map(files.map((f) => [f.version, f]));
  }

  private toFileDto(
    file: DocumentFileEntity | undefined | null,
  ): ReportFileDto | null {
    if (!file) return null;
    return {
      id: file.id,
      version: file.version,
      fileName: file.fileName,
      mimeType: file.mimeType ?? null,
      sizeBytes: file.sizeBytes ?? null,
    };
  }

  private async toStatus(doc: DocumentEntity): Promise<ReportReviewStatusDto> {
    const cycles = await this.cyclesFor(doc.id);
    const byVersion = await this.filesByVersion(doc.id);
    const currentCycle =
      cycles.find((c) => c.roundNo === doc.clientReviewRound) ?? cycles.at(-1);
    const currentFile =
      (currentCycle ? byVersion.get(currentCycle.fileVersion) : undefined) ??
      byVersion.get(doc.currentVersion) ??
      null;

    return {
      documentId: doc.id,
      engagementId: doc.engagement.id,
      engagementReferenceCode: doc.engagement.referenceCode,
      engagementTitle: doc.engagement.title,
      title: doc.title,
      documentStatus: doc.status,
      reviewState: doc.clientReviewState,
      reviewRound: doc.clientReviewRound,
      maxRounds: MAX_REPORT_REVIEW_ROUNDS,
      currentVersion: doc.currentVersion,
      currentFile: this.toFileDto(currentFile),
      cycles: cycles.map((c) => ({
        id: c.id,
        roundNo: c.roundNo,
        fileVersion: c.fileVersion,
        decision: c.decision,
        sentAt: c.sentAt,
        decidedAt: c.decidedAt ?? null,
        feedback: c.feedback ?? null,
        file: this.toFileDto(byVersion.get(c.fileVersion) ?? null),
      })),
    };
  }

  private firmRecipients(doc: DocumentEntity): NotifyRecipient[] {
    return doc.engagement.team.getItems().map((tm) => ({
      userId: tm.user.id,
      email: tm.user.email ?? null,
    }));
  }

  private firmDocumentLink(doc: DocumentEntity): string {
    return `/engagements/${doc.engagement.id}?tab=documents&category=FinalReport&documentId=${doc.id}`;
  }

  /**
   * Client may only touch files that were included in a sent review cycle
   * (never an unsent newer upload).
   */
  private async loadClientAccessibleFile(
    documentId: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ doc: DocumentEntity; file: DocumentFileEntity }> {
    const doc = await this.load(documentId, user, ["engagement"]);
    if (doc.clientReviewState === ReportReviewState.NotSent) {
      throw new NotFoundException("Final report not found");
    }
    const file = await this.em.findOne(DocumentFileEntity, {
      id: fileId,
      document: documentId,
    } as FilterQuery<DocumentFileEntity>);
    if (!file) throw new NotFoundException("File not found");

    const cycles = await this.cyclesFor(documentId);
    const allowedVersions = new Set(cycles.map((c) => c.fileVersion));
    if (!allowedVersions.has(file.version)) {
      throw new NotFoundException("File not found");
    }
    return { doc, file };
  }

  private zipSource(storageKey: string): ZipByteSource {
    return {
      size: async () => {
        const head = await this.storage.head(storageKey);
        if (!head) throw new NotFoundException("Stored file not found");
        return head.sizeBytes;
      },
      read: (start, endInclusive) =>
        this.storage.getObjectRange(storageKey, start, endInclusive),
    };
  }

  // ---- SA: send draft to client -------------------------------------------

  async sendToClient(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ["engagement"]);
    if (doc.currentVersion < 1) {
      throw new BadRequestException(
        "Upload a report file before sending it to the client",
      );
    }
    if (doc.clientReviewState === ReportReviewState.AwaitingClient) {
      throw new ConflictException("This report is already awaiting the client");
    }
    if (doc.clientReviewState === ReportReviewState.Locked) {
      throw new BadRequestException(
        "This report is locked after 3 cycles — use override to finalise",
      );
    }
    if (
      doc.clientReviewState === ReportReviewState.Approved ||
      doc.clientReviewState === ReportReviewState.Overridden
    ) {
      throw new BadRequestException("This report is already finalised");
    }
    if (doc.clientReviewRound >= MAX_REPORT_REVIEW_ROUNDS) {
      throw new BadRequestException("Maximum review cycles reached");
    }

    if (doc.clientReviewState === ReportReviewState.ChangesRequested) {
      const cycles = await this.cyclesFor(doc.id);
      const lastCycle = cycles.at(-1);
      if (lastCycle && doc.currentVersion <= lastCycle.fileVersion) {
        throw new BadRequestException(
          "Upload a revised file before sending again",
        );
      }
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

    const clientRecipients = await engagementClientContactRecipients(
      this.em,
      doc.engagement.id,
    );
    await this.notifications.emit({
      recipients: clientRecipients,
      type: "report.review_requested",
      title: "A final report draft is ready for your review",
      body: `Round ${round} of ${MAX_REPORT_REVIEW_ROUNDS}: please review and approve or request changes.`,
      entityType: "document",
      entityId: doc.id,
      link: `/final-reports/${doc.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.ReportSentForReview, {
      documentId: doc.id,
      round,
    });
    await this.em.flush();
    return this.toStatus(doc);
  }

  // ---- SA: override a locked report ---------------------------------------

  async override(
    documentId: string,
    dto: OverrideReportDto,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ["engagement"]);
    if (doc.clientReviewState !== ReportReviewState.Locked) {
      throw new BadRequestException("Only a locked report can be overridden");
    }
    doc.clientReviewState = ReportReviewState.Overridden;
    doc.status = DocumentStatus.SignedOff;
    const clientRecipients = await engagementClientContactRecipients(
      this.em,
      doc.engagement.id,
    );
    await this.notifications.emit({
      recipients: clientRecipients,
      type: "report.finalised",
      title: "A final report has been issued",
      body: dto.reason,
      entityType: "document",
      entityId: doc.id,
      link: `/final-reports/${doc.id}`,
      excludeUserId: user.userId,
    });
    this.outbox.enqueue(EVENT.ReportReviewDecided, {
      documentId: doc.id,
      outcome: "overridden",
    });
    await this.em.flush();
    return this.toStatus(doc);
  }

  async statusForFirm(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ["engagement"]);
    return this.toStatus(doc);
  }

  async listForFirm(
    user: AuthenticatedUser,
    query: FirmReportListQueryDto,
  ): Promise<Paginated<FirmReportListItemDto>> {
    const eng = engagementScopeWhere(resolveScope(user));
    const state = query.state ?? "needsAction";
    const where: Record<string, unknown> = {
      category: DocumentCategory.FinalReport,
    };

    if (query.reviewState) {
      where.clientReviewState = query.reviewState;
    } else if (state === "needsAction") {
      where.clientReviewState = {
        $in: [ReportReviewState.ChangesRequested, ReportReviewState.Locked],
      };
    } else if (state === "awaitingClient") {
      where.clientReviewState = ReportReviewState.AwaitingClient;
    } else {
      where.clientReviewState = {
        $ne: ReportReviewState.NotSent,
      };
    }

    if (query.engagementId) {
      where.engagement = Object.keys(eng).length
        ? { id: query.engagementId, ...eng }
        : query.engagementId;
    } else if (Object.keys(eng).length) {
      where.engagement = eng;
    }

    const q = query.q?.trim();
    if (q) {
      const pattern = `%${q}%`;
      const feedbackCycles = await this.em.find(
        ReportReviewCycleEntity,
        {
          feedback: { $ilike: pattern },
        } as FilterQuery<ReportReviewCycleEntity>,
        { fields: ["document"] as never },
      );
      const feedbackDocIds = [
        ...new Set(
          feedbackCycles
            .map((c) =>
              typeof c.document === "object" && c.document
                ? c.document.id
                : String(c.document),
            )
            .filter(Boolean),
        ),
      ];
      const or: Record<string, unknown>[] = [
        { title: { $ilike: pattern } },
        { engagement: { referenceCode: { $ilike: pattern } } },
        { engagement: { title: { $ilike: pattern } } },
      ];
      if (feedbackDocIds.length) or.push({ id: { $in: feedbackDocIds } });
      where.$or = or;
    }

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      DocumentEntity,
      where as FilterQuery<DocumentEntity>,
      {
        populate: ["engagement"],
        orderBy: { updatedAt: "desc", id: "asc" },
        limit,
        offset,
      },
    );

    const data: FirmReportListItemDto[] = [];
    for (const d of rows) {
      const cycles = await this.cyclesFor(d.id);
      const latestWithFeedback = [...cycles]
        .reverse()
        .find(
          (c) =>
            c.feedback && c.decision === ReportReviewDecision.ChangesRequested,
        );
      data.push({
        documentId: d.id,
        engagementId: d.engagement.id,
        engagementReferenceCode: d.engagement.referenceCode,
        engagementTitle: d.engagement.title,
        title: d.title,
        reviewState: d.clientReviewState,
        reviewRound: d.clientReviewRound,
        currentVersion: d.currentVersion,
        latestFeedback: latestWithFeedback?.feedback ?? null,
        updatedAt: d.updatedAt,
      });
    }
    return paginated(data, total, page, pageSize);
  }

  // ---- Client: view / respond ---------------------------------------------

  async listPendingForClient(
    user: AuthenticatedUser,
    query: PendingReportListQueryDto,
  ): Promise<Paginated<ClientPendingReportDto>> {
    const eng = engagementScopeWhere(resolveScope(user));
    const state = query.state ?? "pending";
    const { page, pageSize, limit, offset } = pageParams(query);

    // Resolve engagement IDs first. Nesting `clientContacts` under Document→engagement
    // in the same findAndCount as enum filters can yield empty results in MikroORM,
    // even though findOne(id + same scope) and raw SQL joins succeed.
    let engagementIds: string[] | undefined;
    if (Object.keys(eng).length) {
      const scoped = await this.em.find(
        EngagementEntity,
        eng as FilterQuery<EngagementEntity>,
        { fields: ["id"] as never },
      );
      engagementIds = scoped.map((e) => e.id);
      if (!engagementIds.length) {
        return paginated([], 0, page, pageSize);
      }
    }

    const where: Record<string, unknown> = {
      category: DocumentCategory.FinalReport,
    };
    if (state === "all") {
      where.clientReviewState = { $ne: ReportReviewState.NotSent };
    } else {
      where.clientReviewState = ReportReviewState.AwaitingClient;
    }
    if (engagementIds) {
      where.engagement = { $in: engagementIds };
    }

    const [rows, total] = await this.em.findAndCount(
      DocumentEntity,
      where as FilterQuery<DocumentEntity>,
      {
        populate: ["engagement"],
        orderBy: { updatedAt: "desc", id: "asc" },
        limit,
        offset,
      },
    );

    const data: ClientPendingReportDto[] = [];
    for (const d of rows) {
      const cycles = await this.cyclesFor(d.id);
      const currentCycle =
        cycles.find((c) => c.roundNo === d.clientReviewRound) ?? cycles.at(-1);
      const byVersion = await this.filesByVersion(d.id);
      const file = currentCycle
        ? byVersion.get(currentCycle.fileVersion)
        : undefined;
      data.push({
        documentId: d.id,
        engagementId: d.engagement.id,
        engagementReferenceCode: d.engagement.referenceCode,
        engagementTitle: d.engagement.title,
        title: d.title,
        reviewState: d.clientReviewState,
        reviewRound: d.clientReviewRound,
        currentVersion: d.currentVersion,
        sentAt: currentCycle?.sentAt
          ? currentCycle.sentAt instanceof Date
            ? currentCycle.sentAt.toISOString()
            : String(currentCycle.sentAt)
          : null,
        fileName: file?.fileName ?? null,
        mimeType: file?.mimeType ?? null,
      });
    }
    return paginated(data, total, page, pageSize);
  }

  async getForClient(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    const doc = await this.load(documentId, user, ["engagement"]);
    if (doc.clientReviewState === ReportReviewState.NotSent) {
      throw new NotFoundException("Final report not found");
    }
    return this.toStatus(doc);
  }

  async downloadForClient(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const status = await this.getForClient(documentId, user);
    if (!status.currentFile)
      throw new NotFoundException("No report file to download");
    return this.downloadFile(documentId, status.currentFile.id, user);
  }

  async downloadFile(
    documentId: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const { file } = await this.loadClientAccessibleFile(
      documentId,
      fileId,
      user,
    );
    const url = await this.storage.presignDownload(
      file.storageKey,
      file.fileName,
    );
    return { url };
  }

  async previewFile(
    documentId: string,
    fileId: string,
    user: AuthenticatedUser,
    opts?: { retryFailed?: boolean },
  ): Promise<{
    url: string | null;
    mode: "native" | "converted" | "unavailable";
    previewStatus: FilePreviewStatus;
    reason?: "pending" | "failed" | "unsupported";
  }> {
    const { file } = await this.loadClientAccessibleFile(
      documentId,
      fileId,
      user,
    );

    if (
      file.previewStatus === FilePreviewStatus.Ready &&
      file.previewStorageKey
    ) {
      const url = await this.storage.presignDownload(
        file.previewStorageKey,
        `${file.fileName}.pdf`,
        { disposition: "inline" },
      );
      return { url, mode: "converted", previewStatus: file.previewStatus };
    }
    if (isNativePreviewable(file.mimeType, file.fileName)) {
      const url = await this.storage.presignDownload(
        file.storageKey,
        file.fileName,
        {
          disposition: "inline",
        },
      );
      return { url, mode: "native", previewStatus: FilePreviewStatus.Ready };
    }
    if (
      opts?.retryFailed &&
      file.previewStatus === FilePreviewStatus.Failed &&
      isOfficeMime(file.mimeType, file.fileName)
    ) {
      file.previewStatus = FilePreviewStatus.Pending;
      file.previewError = null;
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "document_file",
        fileId: file.id,
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType ?? null,
      });
      await this.em.flush();
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Pending,
        reason: "pending",
      };
    }
    if (file.previewStatus === FilePreviewStatus.Pending) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Pending,
        reason: "pending",
      };
    }
    if (file.previewStatus === FilePreviewStatus.Failed) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Failed,
        reason: "failed",
      };
    }
    if (isOfficeMime(file.mimeType, file.fileName)) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Pending,
        reason: "pending",
      };
    }
    if (!isPreviewAllowlisted(file.mimeType, file.fileName)) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: file.previewStatus,
        reason: "unsupported",
      };
    }
    return {
      url: null,
      mode: "unavailable",
      previewStatus: file.previewStatus,
      reason: "unsupported",
    };
  }

  async zipEntries(
    documentId: string,
    fileId: string,
    user: AuthenticatedUser,
  ) {
    const { file } = await this.loadClientAccessibleFile(
      documentId,
      fileId,
      user,
    );
    if (!isZipMime(file.mimeType, file.fileName)) {
      throw new BadRequestException("File is not a zip archive");
    }
    return {
      entries: await listZipEntriesFromSource(this.zipSource(file.storageKey)),
    };
  }

  async zipEntryUrl(
    documentId: string,
    fileId: string,
    entryPath: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    const { file } = await this.loadClientAccessibleFile(
      documentId,
      fileId,
      user,
    );
    if (!isZipMime(file.mimeType, file.fileName)) {
      throw new BadRequestException("File is not a zip archive");
    }
    const extracted = await extractZipEntryFromSource(
      this.zipSource(file.storageKey),
      entryPath,
    );
    const { storageKey } = await this.storage.upload({
      keyPrefix: `temp/zip-entries/${documentId}`,
      fileName: extracted.name,
      contentType: extracted.mimeType,
      body: extracted.data,
    });
    const url = await this.storage.presignDownload(storageKey, extracted.name, {
      disposition: isPreviewAllowlisted(extracted.mimeType, extracted.name)
        ? "inline"
        : "attachment",
    });
    return { url, fileName: extracted.name, mimeType: extracted.mimeType };
  }

  async respond(
    documentId: string,
    dto: RespondReportDto,
    user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    if (
      dto.decision === ReportReviewDecision.ChangesRequested &&
      !dto.feedback
    ) {
      throw new BadRequestException(
        "Feedback is required when requesting changes",
      );
    }
    const doc = await this.load(documentId, user, ["engagement.team.user"]);
    if (doc.clientReviewState !== ReportReviewState.AwaitingClient) {
      throw new BadRequestException("This report is not awaiting your review");
    }
    const cycle = await this.em.findOne(ReportReviewCycleEntity, {
      document: documentId,
      roundNo: doc.clientReviewRound,
      decision: ReportReviewDecision.Pending,
    } as FilterQuery<ReportReviewCycleEntity>);
    if (!cycle)
      throw new BadRequestException("No open review cycle to respond to");

    cycle.decision = dto.decision;
    cycle.decidedBy = this.em.getReference(UserEntity, user.userId);
    cycle.decidedAt = new Date();
    cycle.feedback = dto.feedback ?? null;

    let title: string;
    if (dto.decision === ReportReviewDecision.Approved) {
      doc.clientReviewState = ReportReviewState.Approved;
      doc.status = DocumentStatus.SignedOff;
      title = "The client approved the final report";
    } else if (doc.clientReviewRound >= MAX_REPORT_REVIEW_ROUNDS) {
      doc.clientReviewState = ReportReviewState.Locked;
      title = "The final report is locked after 3 cycles — override required";
    } else {
      doc.clientReviewState = ReportReviewState.ChangesRequested;
      title = "The client requested changes to the final report";
    }

    await this.notifications.emit({
      recipients: this.firmRecipients(doc),
      type: "report.review_decided",
      title,
      body: dto.feedback,
      entityType: "document",
      entityId: doc.id,
      link: this.firmDocumentLink(doc),
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
