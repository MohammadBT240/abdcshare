import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager, type FilterQuery } from "@mikro-orm/postgresql";
import {
  EVENT,
  FilePreviewStatus,
  SubmissionStatus,
  type Paginated,
} from "@abdcshare/shared";
import { pageParams, paginated } from "../../common/pagination/paginate";
import {
  engagementScopeWhere,
  resolveScope,
} from "../../common/security/access-scope";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";
import { STORAGE, type StoragePort } from "../../common/storage/storage.port";
import { UPLOAD_MAX_BYTES } from "../../common/storage/upload.constants";
import {
  initialPreviewStatus,
  isNativePreviewable,
  isOfficeMime,
  isPreviewAllowlisted,
  isZipMime,
} from "../../common/storage/preview.util";
import {
  extractZipEntryFromSource,
  listZipEntriesFromSource,
  type ZipByteSource,
} from "../../common/storage/zip-entries.util";
import type {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from "../../common/storage/multipart.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { engagementTeamRecipients } from "../notifications/recipient-helpers";
import { OutboxService } from "../outbox/outbox.service";
import { syncInferredRequestStage } from "../requests/request-stage-sync";
import { ClientSubmissionEntity } from "./infrastructure/persistence/client-submission.entity";
import { SubmissionFileEntity } from "./infrastructure/persistence/submission-file.entity";
import { RequestEntity } from "../requests/infrastructure/persistence/request.entity";
import { UserEntity } from "../users/infrastructure/persistence/user.entity";
import type {
  CreateSubmissionDto,
  ReopenSubmissionFileDto,
  UndoReturnSubmissionFileDto,
  ReviewSubmissionDto,
  ReviewSubmissionFileDto,
  SubmissionFileConfirmDto,
  SubmissionFilePresignDto,
  SubmissionListQueryDto,
} from "./presentation/dto/submission.dto";
import { SubmissionResponseDto } from "./presentation/dto/submission.dto";

const SUBMISSION_POPULATE = [
  "request",
  "submittedBy",
  "reviewedBy",
  "files",
  "files.replacesFile",
  "files.reviewedBy",
] as const;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** `where` for a request under the caller's scope (own client / own engagements). */
  private requestScopeWhere(
    requestId: string,
    user?: AuthenticatedUser,
  ): Record<string, unknown> {
    const eng = engagementScopeWhere(resolveScope(user));
    return Object.keys(eng).length
      ? { id: requestId, engagement: eng }
      : { id: requestId };
  }

  /** Files that are not superseded by a newer replacement on the same submission. */
  private currentFiles(
    submission: ClientSubmissionEntity,
  ): SubmissionFileEntity[] {
    const all = submission.files.getItems();
    const supersededIds = new Set(
      all
        .map((f) => f.replacesFile?.id)
        .filter((id): id is string => Boolean(id)),
    );
    return all.filter(
      (f) => !supersededIds.has(f.id) && f.status !== SubmissionStatus.Draft,
    );
  }

  private isSuperseded(
    file: SubmissionFileEntity,
    submission: ClientSubmissionEntity,
  ): boolean {
    return submission.files
      .getItems()
      .some((f) => f.replacesFile?.id === file.id);
  }

  /**
   * Derive submission status from current (non-superseded) files.
   * All Accepted → Accepted; any UnderReview → UnderReview; any Returned → Returned;
   * else Pending. UnderReview reflects active staff review even when other files are returned.
   */
  private deriveStatus(submission: ClientSubmissionEntity): SubmissionStatus {
    if (submission.status === SubmissionStatus.Draft)
      return SubmissionStatus.Draft;
    const current = this.currentFiles(submission);
    if (current.length === 0) return SubmissionStatus.Pending;
    if (current.every((f) => f.status === SubmissionStatus.Accepted)) {
      return SubmissionStatus.Accepted;
    }
    if (current.some((f) => f.status === SubmissionStatus.UnderReview)) {
      return SubmissionStatus.UnderReview;
    }
    if (current.some((f) => f.status === SubmissionStatus.Returned)) {
      return SubmissionStatus.Returned;
    }
    return SubmissionStatus.Pending;
  }

  private isReviewable(status: SubmissionStatus): boolean {
    return (
      status === SubmissionStatus.Pending ||
      status === SubmissionStatus.UnderReview
    );
  }

  private toDto(s: ClientSubmissionEntity): SubmissionResponseDto {
    return {
      id: s.id,
      requestId: s.request.id,
      submittedById: s.submittedBy.id,
      submittedByName: s.submittedBy.fullName ?? null,
      message: s.message,
      status: s.status,
      reviewedById: s.reviewedBy ? s.reviewedBy.id : null,
      reviewReason: s.reviewReason ?? null,
      reviewedAt: s.reviewedAt ?? null,
      files: s.files.getItems().map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType ?? null,
        sizeBytes: f.sizeBytes ?? null,
        status: f.status,
        reviewReason: f.reviewReason ?? null,
        reviewedAt: f.reviewedAt ?? null,
        replacesFileId: f.replacesFile?.id ?? null,
        superseded: this.isSuperseded(f, s),
        uploadedAt: f.uploadedAt,
      })),
      createdAt: s.createdAt,
    };
  }

  /** Load a submission the caller can access (own client / own engagements). */
  private async loadScoped(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ClientSubmissionEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where = Object.keys(eng).length
      ? { id, request: { engagement: eng } }
      : { id };
    const submission = await this.em.findOne(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
      { populate: [...SUBMISSION_POPULATE] },
    );
    if (!submission) throw new NotFoundException("Submission not found");
    return submission;
  }

  private assertOwner(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
  ): void {
    if (submission.submittedBy.id !== user.userId) {
      throw new ForbiddenException("Only the submitter can modify this draft");
    }
  }

  private assertCanAttach(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
    replacing = false,
  ): void {
    // Progressive uploads: owner may attach new files while staff reviews others.
    const openForAttach =
      submission.status === SubmissionStatus.Draft ||
      submission.status === SubmissionStatus.Pending ||
      submission.status === SubmissionStatus.UnderReview ||
      submission.status === SubmissionStatus.Returned;

    if (replacing) {
      // confirmFile still requires the specific target file to be Returned.
      if (!openForAttach || submission.status === SubmissionStatus.Draft) {
        throw new BadRequestException(
          "Can only replace files on a returned, pending, or under-review response",
        );
      }
      this.assertOwner(submission, user);
      return;
    }

    if (!openForAttach) {
      throw new BadRequestException(
        "Cannot attach files to an already-reviewed submission",
      );
    }
    this.assertOwner(submission, user);
  }

  /** Staff notification when a client response becomes visible (first published file). */
  private async notifyStaffResponseCreated(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.em.populate(submission, ["request.engagement"]);
    const staff = await engagementTeamRecipients(
      this.em,
      submission.request.engagement.id,
    );
    await this.notifications.emit({
      recipients: staff,
      type: "submission.created",
      title: "A client responded to a request",
      body: submission.message.slice(0, 140),
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });
  }

  /** Lighter notify when more files arrive on an already-visible response. */
  private async notifyStaffAdditionalFile(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
    fileName: string,
  ): Promise<void> {
    await this.em.populate(submission, ["request.engagement"]);
    const staff = await engagementTeamRecipients(
      this.em,
      submission.request.engagement.id,
    );
    await this.notifications.emit({
      recipients: staff,
      type: "submission.created",
      title: "Client added a file to a response",
      body: fileName.slice(0, 140),
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });
  }

  private assertSizeCap(sizeBytes?: number): void {
    if (sizeBytes != null && sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
  }

  private async notifyStaffResubmit(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
    fileName: string,
  ): Promise<void> {
    await this.em.populate(submission, ["request.engagement"]);
    const staff = await engagementTeamRecipients(
      this.em,
      submission.request.engagement.id,
    );
    await this.notifications.emit({
      recipients: staff,
      type: "submission.created",
      title: "A client resubmitted a file",
      body: fileName.slice(0, 140),
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });
  }

  private async notifyClientStatusChange(
    submission: ClientSubmissionEntity,
    previous: SubmissionStatus,
    next: SubmissionStatus,
    user: AuthenticatedUser,
    reason?: string | null,
  ): Promise<void> {
    if (previous === next) return;
    if (
      next !== SubmissionStatus.Accepted &&
      next !== SubmissionStatus.Returned
    )
      return;
    await this.notifications.emit({
      recipients: [
        {
          userId: submission.submittedBy.id,
          email: submission.submittedBy.email ?? null,
        },
      ],
      type: "submission.reviewed",
      title: `Your response was ${next === SubmissionStatus.Accepted ? "accepted" : "returned"}`,
      body: reason ?? undefined,
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });
  }

  /**
   * Recompute parent status from current files; notify client when Accepted/Returned changes.
   */
  private async recomputeStatus(
    submission: ClientSubmissionEntity,
    user: AuthenticatedUser,
    reason?: string | null,
  ): Promise<void> {
    const previous = submission.status;
    const next = this.deriveStatus(submission);
    if (previous === next) return;
    submission.status = next;
    if (
      next === SubmissionStatus.Accepted ||
      next === SubmissionStatus.Returned
    ) {
      submission.reviewedBy = this.em.getReference(UserEntity, user.userId);
      submission.reviewedAt = new Date();
      submission.reviewReason = reason ?? submission.reviewReason ?? null;
    } else if (
      next === SubmissionStatus.Pending ||
      next === SubmissionStatus.UnderReview
    ) {
      // Still in the review queue.
      submission.reviewedBy = null;
      submission.reviewedAt = null;
      submission.reviewReason = null;
    }
    await this.notifyClientStatusChange(
      submission,
      previous,
      next,
      user,
      reason,
    );
  }

  /** Presign an upload for a file to attach to a submission (client). */
  async presignFile(
    id: string,
    dto: SubmissionFilePresignDto,
    user: AuthenticatedUser,
  ) {
    const submission = await this.loadScoped(id, user);
    this.assertCanAttach(submission, user, Boolean(dto.replacesFileId));
    return this.storage.presignUpload({
      keyPrefix: `submissions/${id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async createMultipart(
    id: string,
    dto: MultipartCreateDto,
    user: AuthenticatedUser,
  ) {
    const submission = await this.loadScoped(id, user);
    this.assertCanAttach(submission, user, Boolean(dto.replacesFileId));
    this.assertSizeCap(dto.sizeBytes);
    return this.storage.createMultipart({
      keyPrefix: `submissions/${id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async signMultipartParts(
    id: string,
    uploadId: string,
    storageKey: string,
    dto: MultipartSignPartsDto,
    user: AuthenticatedUser,
  ) {
    const submission = await this.loadScoped(id, user);
    // Parts are signed after create; createMultipart already validated attach rights.
    this.assertCanAttach(submission, user, false);
    if (!storageKey.includes(`submissions/${id}`)) {
      throw new BadRequestException("Invalid storage key for this submission");
    }
    const parts = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const { url } = await this.storage.presignPart(
          storageKey,
          uploadId,
          partNumber,
        );
        return { partNumber, url };
      }),
    );
    return { parts };
  }

  async completeMultipart(
    id: string,
    uploadId: string,
    dto: MultipartCompleteDto & { replacesFileId?: string },
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    this.assertCanAttach(submission, user, Boolean(dto.replacesFileId));
    this.assertSizeCap(dto.sizeBytes);
    if (!dto.storageKey.includes(`submissions/${id}`)) {
      throw new BadRequestException("Invalid storage key for this submission");
    }
    await this.storage.completeMultipart(dto.storageKey, uploadId, dto.parts);
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException("Uploaded object not found");
    if (dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    return this.confirmFile(
      id,
      {
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: head.sizeBytes,
        replacesFileId: dto.replacesFileId,
      },
      user,
    );
  }

  async abortMultipart(
    id: string,
    uploadId: string,
    dto: MultipartAbortDto,
    user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const submission = await this.loadScoped(id, user);
    this.assertCanAttach(submission, user, false);
    await this.storage.abortMultipart(dto.storageKey, uploadId);
    return { ok: true };
  }

  /**
   * Confirm an uploaded file onto a submission.
   * Progressive publish: each confirmed file is Pending and visible to staff.
   * The first file on a Draft promotes the response and notifies the team;
   * further files notify that more content arrived.
   */
  async confirmFile(
    id: string,
    dto: SubmissionFileConfirmDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    this.assertCanAttach(submission, user, Boolean(dto.replacesFileId));

    let replaces: SubmissionFileEntity | null = null;
    if (dto.replacesFileId) {
      replaces =
        submission.files.getItems().find((f) => f.id === dto.replacesFileId) ??
        null;
      if (!replaces)
        throw new BadRequestException(
          "File to replace not found on this submission",
        );
      if (replaces.status !== SubmissionStatus.Returned) {
        throw new BadRequestException("Only returned files can be replaced");
      }
      if (this.isSuperseded(replaces, submission)) {
        throw new BadRequestException("That file has already been replaced");
      }
      this.assertOwner(submission, user);
    }

    const wasDraft = submission.status === SubmissionStatus.Draft;
    const previewStatus = initialPreviewStatus(dto.mimeType, dto.fileName);
    const file = this.em.create(SubmissionFileEntity, {
      submission,
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null,
      status: SubmissionStatus.Pending,
      replacesFile: replaces,
      previewStatus,
    });

    if (previewStatus === FilePreviewStatus.Pending) {
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "submission_file",
        fileId: file.id,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType ?? null,
      });
    }

    if (wasDraft) {
      submission.status = SubmissionStatus.Pending;
      for (const existing of submission.files.getItems()) {
        if (existing.status === SubmissionStatus.Draft) {
          existing.status = SubmissionStatus.Pending;
        }
      }
      await this.notifyStaffResponseCreated(submission, user);
      await syncInferredRequestStage(this.em, submission.request.id, {
        actorId: user.userId,
      });
    } else if (replaces) {
      await this.recomputeStatus(submission, user);
      await this.notifyStaffResubmit(submission, user, dto.fileName);
    } else {
      // Additional file on an already-visible response.
      await this.recomputeStatus(submission, user);
      await this.notifyStaffAdditionalFile(submission, user, dto.fileName);
    }

    await this.em.flush();
    return this.getOne(id, user);
  }

  async downloadUrl(
    id: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const submission = await this.loadScoped(id, user);
    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    const url = await this.storage.presignDownload(
      file.storageKey,
      file.fileName,
    );
    return { url };
  }

  /**
   * Queue a background zip of current (non-superseded) files.
   * Caller is notified in-app when the archive is ready (or if it fails).
   */
  async requestExport(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ accepted: true; jobId: string }> {
    const submission = await this.loadScoped(id, user);
    const files = this.currentFiles(submission);
    if (files.length === 0) {
      throw new BadRequestException("This response has no files to download");
    }
    const job = this.outbox.enqueue(EVENT.SubmissionExportRequested, {
      submissionId: submission.id,
      actorUserId: user.userId,
    });
    await this.em.flush();
    return { accepted: true, jobId: job.id };
  }

  /**
   * Mint a short-lived download URL for a previously built export zip.
   * `storageKey` must belong to this submission's export prefix.
   */
  async exportDownloadUrl(
    id: string,
    storageKey: string,
    fileName: string | undefined,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    await this.loadScoped(id, user);
    const marker = `exports/submissions/${id}/`;
    if (!storageKey.includes(marker)) {
      throw new ForbiddenException('Invalid export key');
    }
    const name =
      fileName?.replace(/[\\/]/g, '') ||
      storageKey.split('/').pop() ||
      'response.zip';
    const url = await this.storage.presignDownload(storageKey, name, {
      disposition: 'attachment',
    });
    return { url };
  }

  async previewUrl(
    id: string,
    fileId: string,
    user: AuthenticatedUser,
    opts?: { retryFailed?: boolean },
  ): Promise<{
    url: string | null;
    mode: "native" | "converted" | "unavailable";
    previewStatus: FilePreviewStatus;
    reason?: "pending" | "failed" | "unsupported";
  }> {
    const submission = await this.loadScoped(id, user);
    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");

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

    // One-shot retry when the client explicitly asks (dialog open), not on polls.
    if (
      opts?.retryFailed &&
      file.previewStatus === FilePreviewStatus.Failed &&
      isOfficeMime(file.mimeType, file.fileName)
    ) {
      file.previewStatus = FilePreviewStatus.Pending;
      file.previewError = null;
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "submission_file",
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

  async zipEntries(id: string, fileId: string, user: AuthenticatedUser) {
    const submission = await this.loadScoped(id, user);
    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (!isZipMime(file.mimeType, file.fileName)) {
      throw new BadRequestException("File is not a zip archive");
    }
    const entries = await listZipEntriesFromSource(
      this.zipSource(file.storageKey),
    );
    return { entries };
  }

  /** Extract one zip member to temp storage and return a short-lived inline URL. */
  async zipEntryUrl(
    id: string,
    fileId: string,
    entryPath: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    const submission = await this.loadScoped(id, user);
    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (!isZipMime(file.mimeType, file.fileName)) {
      throw new BadRequestException("File is not a zip archive");
    }
    const extracted = await extractZipEntryFromSource(
      this.zipSource(file.storageKey),
      entryPath,
    );
    const { storageKey } = await this.storage.upload({
      keyPrefix: `temp/zip-entries/${id}`,
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

  /**
   * Client starts a response shell. Remains Draft (staff-hidden) until the first
   * file is confirmed — then confirmFile promotes and notifies.
   */
  async create(
    requestId: string,
    dto: CreateSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const request = await this.em.findOne(
      RequestEntity,
      this.requestScopeWhere(requestId, user) as FilterQuery<RequestEntity>,
      { populate: ["engagement.team.user"] },
    );
    if (!request) throw new NotFoundException("Request not found");
    const submission = this.em.create(ClientSubmissionEntity, {
      request,
      submittedBy: this.em.getReference(UserEntity, user.userId),
      message: dto.message,
      status: SubmissionStatus.Draft,
    });
    await this.em.persistAndFlush(submission);
    return this.getOne(submission.id, user);
  }

  /**
   * Legacy batch promote. Prefer progressive confirmFile (first file auto-publishes).
   * Still useful if any Draft-status files remain on a Draft shell.
   */
  async finalize(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    this.assertOwner(submission, user);
    if (submission.status !== SubmissionStatus.Draft) {
      // Already published via progressive confirm — idempotent success.
      return this.getOne(id, user);
    }
    if (submission.files.getItems().length === 0) {
      throw new BadRequestException(
        "Attach at least one file before sending a response",
      );
    }

    submission.status = SubmissionStatus.Pending;
    for (const file of submission.files.getItems()) {
      if (file.status === SubmissionStatus.Draft)
        file.status = SubmissionStatus.Pending;
    }

    await this.notifyStaffResponseCreated(submission, user);
    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /**
   * Discard an unfinished draft shell (owner only). Cascades submission files.
   * Once published (Pending+), discard is refused — staff may already be reviewing.
   */
  async discardDraft(id: string, user: AuthenticatedUser): Promise<void> {
    const submission = await this.loadScoped(id, user);
    this.assertOwner(submission, user);
    if (submission.status !== SubmissionStatus.Draft) {
      throw new BadRequestException(
        "Only unpublished drafts can be discarded — this response is already visible to the team",
      );
    }
    await this.em.removeAndFlush(submission);
  }

  async list(
    requestId: string,
    query: SubmissionListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<SubmissionResponseDto>> {
    const where: Record<string, unknown> = {
      request: this.requestScopeWhere(requestId, user),
    };
    if (query.status) {
      where.status = query.status;
    } else if (user) {
      where.$or = [
        { status: { $ne: SubmissionStatus.Draft } },
        { submittedBy: user.userId, status: SubmissionStatus.Draft },
      ];
    } else {
      where.status = { $ne: SubmissionStatus.Draft };
    }

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
      {
        populate: [...SUBMISSION_POPULATE],
        orderBy: { createdAt: "desc", id: "asc" },
        limit,
        offset,
      },
    );
    return paginated(
      rows.map((s) => this.toDto(s)),
      total,
      page,
      pageSize,
    );
  }

  async getOne(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where = Object.keys(eng).length
      ? { id, request: { engagement: eng } }
      : { id };
    const submission = await this.em.findOne(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
      {
        populate: [...SUBMISSION_POPULATE],
      },
    );
    if (!submission) throw new NotFoundException("Submission not found");
    if (
      submission.status === SubmissionStatus.Draft &&
      user &&
      submission.submittedBy.id !== user.userId
    ) {
      throw new NotFoundException("Submission not found");
    }
    return this.toDto(submission);
  }

  /**
   * Claim a Pending file for review (Pending → UnderReview).
   * Idempotent when already UnderReview. No client notification.
   */
  async startReview(
    id: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException("Cannot review a draft submission");
    }

    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (this.isSuperseded(file, submission)) {
      throw new BadRequestException("Cannot review a superseded file");
    }

    if (file.status === SubmissionStatus.UnderReview) {
      return this.getOne(id, user);
    }
    if (file.status !== SubmissionStatus.Pending) {
      throw new BadRequestException(
        `Only pending files can be marked under review (${file.status})`,
      );
    }

    file.status = SubmissionStatus.UnderReview;
    file.reviewedBy = this.em.getReference(UserEntity, user.userId);
    file.reviewedAt = null;
    file.reviewReason = null;

    await this.recomputeStatus(submission, user);
    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /** Per-file accept/return. Parent status is derived from current files. */
  async reviewFile(
    id: string,
    fileId: string,
    dto: ReviewSubmissionFileDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException("Cannot review a draft submission");
    }
    if (dto.decision === SubmissionStatus.Returned && !dto.reason?.trim()) {
      throw new BadRequestException(
        "A reason is required when returning a file",
      );
    }

    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (this.isSuperseded(file, submission)) {
      throw new BadRequestException("Cannot review a superseded file");
    }
    if (!this.isReviewable(file.status)) {
      throw new BadRequestException(`File already reviewed (${file.status})`);
    }

    file.status = dto.decision;
    file.reviewReason = dto.reason?.trim() || null;
    file.reviewedBy = this.em.getReference(UserEntity, user.userId);
    file.reviewedAt = new Date();

    await this.recomputeStatus(submission, user, dto.reason?.trim() || null);
    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /**
   * Undo acceptance: Accepted → UnderReview. No client notify; no replacement unlock.
   */
  async undoAcceptFile(
    id: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException(
        "Cannot undo acceptance on a draft submission",
      );
    }

    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (this.isSuperseded(file, submission)) {
      throw new BadRequestException("Cannot undo a superseded file");
    }
    if (file.status !== SubmissionStatus.Accepted) {
      throw new BadRequestException(
        "Only accepted files can have acceptance undone",
      );
    }

    file.status = SubmissionStatus.UnderReview;
    file.reviewReason = null;
    file.reviewedBy = this.em.getReference(UserEntity, user.userId);
    file.reviewedAt = null;

    await this.recomputeStatus(submission, user);
    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /**
   * Reopen an Accepted file for further review: Accepted → UnderReview with reason.
   * Does not unlock client replacement (use Return for that). Notifies the submitter.
   */
  async reopenFile(
    id: string,
    fileId: string,
    dto: ReopenSubmissionFileDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException("A reason is required to reopen a file");
    }

    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException(
        "Cannot reopen a file on a draft submission",
      );
    }

    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (this.isSuperseded(file, submission)) {
      throw new BadRequestException("Cannot reopen a superseded file");
    }
    if (file.status !== SubmissionStatus.Accepted) {
      throw new BadRequestException(
        "Only accepted files can be reopened for revision",
      );
    }

    file.status = SubmissionStatus.UnderReview;
    file.reviewReason = reason;
    file.reviewedBy = this.em.getReference(UserEntity, user.userId);
    file.reviewedAt = null;

    await this.recomputeStatus(submission, user);
    await this.notifications.emit({
      recipients: [
        {
          userId: submission.submittedBy.id,
          email: submission.submittedBy.email ?? null,
        },
      ],
      type: "submission.reviewed",
      title: `A file was reopened for review: ${file.fileName}`,
      body: reason,
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });

    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /**
   * Undo a file return: Returned → UnderReview with reason.
   * Clears client replacement unlock for that file. Notifies the submitter.
   */
  async undoReturnFile(
    id: string,
    fileId: string,
    dto: UndoReturnSubmissionFileDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException("A reason is required to undo a return");
    }

    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException(
        "Cannot undo return on a draft submission",
      );
    }

    const file = submission.files.getItems().find((f) => f.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    if (this.isSuperseded(file, submission)) {
      throw new BadRequestException("Cannot undo return on a superseded file");
    }
    if (file.status !== SubmissionStatus.Returned) {
      throw new BadRequestException("Only returned files can have return undone");
    }

    file.status = SubmissionStatus.UnderReview;
    file.reviewReason = reason;
    file.reviewedBy = this.em.getReference(UserEntity, user.userId);
    file.reviewedAt = null;

    await this.recomputeStatus(submission, user);
    await this.notifications.emit({
      recipients: [
        {
          userId: submission.submittedBy.id,
          email: submission.submittedBy.email ?? null,
        },
      ],
      type: "submission.reviewed",
      title: `A file return was undone: ${file.fileName}`,
      body: reason,
      entityType: "request",
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });

    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /**
   * Bulk review: apply decision to all current Pending/UnderReview files, then recompute.
   * Kept for "Accept all" convenience.
   */
  async review(
    id: string,
    dto: ReviewSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    if (submission.status === SubmissionStatus.Draft) {
      throw new BadRequestException("Cannot review a draft submission");
    }
    if (dto.decision === SubmissionStatus.Returned && !dto.reason?.trim()) {
      throw new BadRequestException("A reason is required when returning");
    }

    const reviewable = this.currentFiles(submission).filter((f) =>
      this.isReviewable(f.status),
    );
    if (reviewable.length === 0) {
      throw new BadRequestException("No pending files to review");
    }

    const now = new Date();
    for (const file of reviewable) {
      file.status = dto.decision;
      file.reviewReason = dto.reason?.trim() || null;
      file.reviewedBy = this.em.getReference(UserEntity, user.userId);
      file.reviewedAt = now;
    }

    await this.recomputeStatus(submission, user, dto.reason?.trim() || null);
    await syncInferredRequestStage(this.em, submission.request.id, {
      actorId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }
}
