import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager, type FilterQuery } from "@mikro-orm/postgresql";
import {
  DocumentCategory,
  DocumentStatus,
  EngagementPhase,
  EVENT,
  FilePreviewStatus,
  hasPermission,
  phaseForStage,
  ReportReviewState,
  type Paginated,
} from "@abdcshare/shared";
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
import { pageParams, paginated } from "../../common/pagination/paginate";
import {
  engagementScopeWhere,
  resolveScope,
} from "../../common/security/access-scope";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";
import { STORAGE, type StoragePort } from "../../common/storage/storage.port";
import type {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from "../../common/storage/multipart.dto";
import { OutboxService } from "../outbox/outbox.service";
import { NotificationsService } from "../notifications/notifications.service";
import { engagementTeamRecipients } from "../notifications/recipient-helpers";
import { DocumentEntity } from "./infrastructure/persistence/document.entity";
import { DocumentFileEntity } from "./infrastructure/persistence/document-file.entity";
import { DocumentParticipantEntity } from "./infrastructure/persistence/document-participant.entity";
import { EngagementEntity } from "../engagements/infrastructure/persistence/engagement.entity";
import { EngagementRequestClassEntity } from "../engagements/infrastructure/persistence/engagement-request-class.entity";
import { RequestClassEntity } from "../request-classes/infrastructure/persistence/request-class.entity";
import { RequestEntity } from "../requests/infrastructure/persistence/request.entity";
import { UserEntity } from "../users/infrastructure/persistence/user.entity";
import { DOCUMENT_MAX_BYTES } from "./documents.constants";
import type {
  AddDocumentParticipantDto,
  ConfirmUploadDto,
  CreateDocumentDto,
  DocumentListQueryDto,
  ExportDocumentsDto,
  PresignUploadDto,
  SetDocumentStatusDto,
  UpdateDocumentDto,
} from "./presentation/dto/document.dto";
import {
  DocumentDetailResponseDto,
  DocumentResponseDto,
  PresignedUploadResponseDto,
} from "./presentation/dto/document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** Where-clause for a document under the caller's access scope. */
  private scopedWhere(
    id: string,
    user?: AuthenticatedUser,
  ): Record<string, unknown> {
    const eng = engagementScopeWhere(resolveScope(user));
    return Object.keys(eng).length ? { id, engagement: eng } : { id };
  }

  private async findScoped(
    id: string,
    user: AuthenticatedUser | undefined,
    populate?: string[],
  ): Promise<DocumentEntity> {
    const doc = await this.em.findOne(
      DocumentEntity,
      this.scopedWhere(id, user) as FilterQuery<DocumentEntity>,
      populate ? { populate: populate as never } : undefined,
    );
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  private toDto(d: DocumentEntity): DocumentResponseDto {
    return {
      id: d.id,
      engagementId: d.engagement.id,
      requestClassId: d.requestClass ? d.requestClass.id : null,
      requestClassName: d.requestClass ? d.requestClass.name : null,
      requestId: d.request ? d.request.id : null,
      departmentId: d.department.id,
      category: d.category,
      phase: d.phase ?? null,
      title: d.title,
      description: d.description ?? null,
      status: d.status,
      currentVersion: d.currentVersion,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private toDetailDto(d: DocumentEntity): DocumentDetailResponseDto {
    return {
      ...this.toDto(d),
      files: d.files
        .getItems()
        .sort((a, b) => b.version - a.version)
        .map((f) => ({
          id: f.id,
          version: f.version,
          fileName: f.fileName,
          mimeType: f.mimeType ?? null,
          sizeBytes: f.sizeBytes ?? null,
          uploadedAt: f.uploadedAt,
        })),
      participants: d.participants.getItems().map((p) => ({
        userId: p.user.id,
        fullName: p.user.fullName,
        participantRole: p.participantRole,
      })),
    };
  }

  /** Load an engagement the caller may act on (staff ⇒ must be on the team). */
  private async accessibleEngagement(
    engagementId: string,
    user: AuthenticatedUser,
  ): Promise<EngagementEntity> {
    const engagement = await this.em.findOne(EngagementEntity, {
      id: engagementId,
      ...engagementScopeWhere(resolveScope(user)),
    } as FilterQuery<EngagementEntity>);
    if (!engagement)
      throw new NotFoundException("Engagement not found or not accessible");
    return engagement;
  }

  async create(
    dto: CreateDocumentDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    this.assertCreatePermission(dto.category, user);

    const engagement = await this.accessibleEngagement(dto.engagementId, user);

    // Supporting + FinalReport: engagement-level (no request class).
    // WorkingPaper: optional request class (must be in engagement scope when set).
    let requestClass = null;
    if (dto.category === DocumentCategory.FinalReport) {
      // Engagement deliverable — ignore class/request linkage.
    } else if (dto.category === DocumentCategory.WorkingPaper) {
      if (dto.requestClassId != null) {
        const inScope = await this.em.findOne(EngagementRequestClassEntity, {
          engagement: dto.engagementId,
          requestClass: dto.requestClassId,
        });
        if (!inScope) {
          throw new BadRequestException(
            "request class is not in scope for this engagement — add it first",
          );
        }
        requestClass = this.em.getReference(
          RequestClassEntity,
          dto.requestClassId,
        );
      }
    }
    // Supporting: engagement-level reference material — request class ignored.

    let request: RequestEntity | null = null;
    if (
      dto.category === DocumentCategory.WorkingPaper &&
      dto.requestId
    ) {
      request = await this.em.findOne(RequestEntity, {
        id: dto.requestId,
        engagement: dto.engagementId,
      });
      if (!request)
        throw new BadRequestException(
          "Request does not belong to this engagement",
        );
    }

    const doc = this.em.create(DocumentEntity, {
      engagement,
      requestClass,
      request,
      phase: dto.phase ?? phaseForStage(engagement.stage),
      department: engagement.department, // inherit the engagement's owning department
      category: dto.category,
      title: dto.title,
      description: dto.description ?? null,
      status: DocumentStatus.Draft,
      currentVersion: 0,
      clientReviewState: ReportReviewState.NotSent,
      clientReviewRound: 0,
      createdBy: this.em.getReference(UserEntity, user.userId),
    });
    this.outbox.enqueue(EVENT.DocumentCreated, {
      documentId: doc.id,
      category: doc.category,
    });
    await this.em.persistAndFlush(doc);
    return this.getOne(doc.id, user);
  }

  /** Permission for create: Supporting → engagement:update; WorkingPaper → working-paper:upload; FinalReport → final-report:upload. */
  private assertCreatePermission(
    category: DocumentCategory,
    user: AuthenticatedUser,
  ): void {
    if (category === DocumentCategory.Supporting) {
      if (
        !hasPermission(user.role, "engagement:update", user.partnerDesignation)
      ) {
        throw new ForbiddenException(
          "engagement:update is required to create supporting documents",
        );
      }
      return;
    }
    if (category === DocumentCategory.FinalReport) {
      if (
        !hasPermission(
          user.role,
          "final-report:upload",
          user.partnerDesignation,
        )
      ) {
        throw new ForbiddenException(
          "Only a Super Admin may create a final report",
        );
      }
      return;
    }
    if (
      !hasPermission(user.role, "working-paper:upload", user.partnerDesignation)
    ) {
      throw new ForbiddenException(
        "working-paper:upload is required to create working papers",
      );
    }
  }

  /** Permission for file upload / mutate on an existing document, based on its category. */
  private assertUploadPermission(
    category: DocumentCategory,
    user: AuthenticatedUser,
  ): void {
    this.assertCreatePermission(category, user);
  }

  async list(
    query: DocumentListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<DocumentResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.requestClassId) where.requestClass = query.requestClassId;
    if (query.requestId) where.request = query.requestId;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.phase) where.phase = query.phase;
    if (query.q) where.title = { $ilike: `%${query.q}%` };

    const engWhere: Record<string, unknown> = {
      ...engagementScopeWhere(resolveScope(user)),
    };
    if (query.engagementId) engWhere.id = query.engagementId;
    if (Object.keys(engWhere).length) where.engagement = engWhere;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      DocumentEntity,
      where as FilterQuery<DocumentEntity>,
      {
        populate: ["requestClass", "request", "department"],
        orderBy: { createdAt: "desc", id: "asc" },
        limit,
        offset,
      },
    );
    return paginated(
      rows.map((d) => this.toDto(d)),
      total,
      page,
      pageSize,
    );
  }

  async exportDocuments(
    dto: ExportDocumentsDto,
    user: AuthenticatedUser,
  ): Promise<{ accepted: true; jobId: string }> {
    await this.accessibleEngagement(dto.engagementId, user);
    const job = this.outbox.enqueue(EVENT.DocumentExportRequested, {
      engagementId: dto.engagementId,
      requestClassId: dto.requestClassId ?? null,
      category: dto.category ?? null,
      actorUserId: user.userId,
    });
    await this.em.flush();
    return { accepted: true, jobId: job.id };
  }

  async getOne(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, [
      "requestClass",
      "request",
      "department",
      "files",
      "participants.user",
    ]);
    return this.toDetailDto(doc);
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user);
    this.assertUploadPermission(doc.category, user);
    if (dto.title != null) doc.title = dto.title;
    if (dto.description !== undefined)
      doc.description = dto.description ?? null;
    await this.em.flush();
    return this.getOne(id, user);
  }

  /** Delete a document (Super Admin) — cascades files + participants. */
  async remove(id: string, user: AuthenticatedUser): Promise<{ ok: true }> {
    const doc = await this.findScoped(id, user);
    // NOTE: object-storage cleanup of the files is left to the storage layer /
    // a future worker sweep; the DB rows cascade via the FK delete rules.
    await this.em.removeAndFlush(doc);
    return { ok: true };
  }

  /** Step 1 of upload: get a presigned URL to PUT the bytes to (no DB write). */
  async presignUpload(
    id: string,
    dto: PresignUploadDto,
    user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    const presigned = await this.storage.presignUpload({
      keyPrefix: `documents/${doc.engagement.id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
    return { ...presigned };
  }

  async createMultipart(id: string, dto: MultipartCreateDto, user: AuthenticatedUser) {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    if (dto.sizeBytes != null && dto.sizeBytes > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    return this.storage.createMultipart({
      keyPrefix: `documents/${doc.engagement.id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async signMultipartParts(
    id: string,
    uploadId: string,
    dto: MultipartSignPartsDto,
    user: AuthenticatedUser,
  ) {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    if (!dto.storageKey.includes(`documents/${doc.engagement.id}`)) {
      throw new BadRequestException("Invalid storage key for this document");
    }
    const parts = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const { url } = await this.storage.presignPart(dto.storageKey, uploadId, partNumber);
        return { partNumber, url };
      }),
    );
    return { parts };
  }

  async completeMultipart(
    id: string,
    uploadId: string,
    dto: MultipartCompleteDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    if (dto.sizeBytes > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    if (!dto.storageKey.includes(`documents/${doc.engagement.id}`)) {
      throw new BadRequestException("Invalid storage key for this document");
    }
    await this.storage.completeMultipart(dto.storageKey, uploadId, dto.parts);
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException("Uploaded object not found");
    if (dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    return this.confirmUpload(
      id,
      {
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: head.sizeBytes,
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
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    await this.storage.abortMultipart(dto.storageKey, uploadId);
    return { ok: true };
  }

  /** Bulk presign: one presigned upload per file (no DB write). */
  async presignUploadBatch(
    id: string,
    files: PresignUploadDto[],
    user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto[]> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    return Promise.all(
      files.map((f) =>
        this.storage.presignUpload({
          keyPrefix: `documents/${doc.engagement.id}`,
          fileName: f.fileName,
          contentType: f.contentType,
        }),
      ),
    );
  }

  /** Bulk confirm: each file becomes the next version, in order. */
  async confirmUploadBatch(
    id: string,
    files: ConfirmUploadDto[],
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    let version = doc.currentVersion;
    const fileIds: string[] = [];
    for (const dto of files) {
      version += 1;
      const previewStatus = initialPreviewStatus(dto.mimeType, dto.fileName);
      const file = this.em.create(DocumentFileEntity, {
        document: doc,
        version,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        uploadedBy: this.em.getReference(UserEntity, user.userId),
        previewStatus,
      });
      fileIds.push(file.id);
      if (previewStatus === FilePreviewStatus.Pending) {
        this.outbox.enqueue(EVENT.FilePreviewRequested, {
          entityType: "document_file",
          fileId: file.id,
          storageKey: dto.storageKey,
          fileName: dto.fileName,
          mimeType: dto.mimeType ?? null,
        });
      }
    }
    doc.currentVersion = version;
    if (doc.status === DocumentStatus.Draft) doc.status = DocumentStatus.Ready;
    this.outbox.enqueue(EVENT.DocumentFileUploaded, {
      documentId: doc.id,
      fileIds,
      count: files.length,
    });
    const team = await engagementTeamRecipients(this.em, doc.engagement.id);
    await this.notifications.emit({
      recipients: team,
      type: "document.uploaded",
      title: `Document upload: ${doc.title}`,
      body: `${files.length} file(s) · ${doc.category}`,
      entityType: "document",
      entityId: doc.id,
      link: `/engagements/${doc.engagement.id}`,
      excludeUserId: user.userId,
    });
    await this.em.persistAndFlush(doc);
    return this.getOne(id, user);
  }

  /** Step 2: confirm the upload → new versioned file row + status/version bump + event. */
  async confirmUpload(
    id: string,
    dto: ConfirmUploadDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    const version = doc.currentVersion + 1;
    const previewStatus = initialPreviewStatus(dto.mimeType, dto.fileName);
    const file = this.em.create(DocumentFileEntity, {
      document: doc,
      version,
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null,
      uploadedBy: this.em.getReference(UserEntity, user.userId),
      previewStatus,
    });
    doc.currentVersion = version;
    if (doc.status === DocumentStatus.Draft) doc.status = DocumentStatus.Ready;
    this.outbox.enqueue(EVENT.DocumentFileUploaded, {
      documentId: doc.id,
      fileId: file.id,
      version,
    });
    if (previewStatus === FilePreviewStatus.Pending) {
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "document_file",
        fileId: file.id,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType ?? null,
      });
    }
    const team = await engagementTeamRecipients(this.em, doc.engagement.id);
    await this.notifications.emit({
      recipients: team,
      type: "document.uploaded",
      title: `Document upload: ${doc.title}`,
      body: `${dto.fileName} · v${version}`,
      entityType: "document",
      entityId: doc.id,
      link: `/engagements/${doc.engagement.id}`,
      excludeUserId: user.userId,
    });
    await this.em.persistAndFlush(file);
    return this.getOne(id, user);
  }

  /**
   * Server-side multipart upload (preferred for Supporting / Planning preliminaries when
   * browser cannot PUT to object storage). Writes bytes via StoragePort.upload then confirms.
   */
  async uploadDirect(
    id: string,
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, ["requestClass"]);
    this.assertUploadPermission(doc.category, user);
    if (!file?.buffer?.length)
      throw new BadRequestException("A file is required");
    if (file.size > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException("File must be 100 MB or smaller");
    }
    const { storageKey } = await this.storage.upload({
      keyPrefix: `documents/${doc.engagement.id}`,
      fileName: file.originalname,
      contentType: file.mimetype || "application/octet-stream",
      body: file.buffer,
    });
    return this.confirmUpload(
      id,
      {
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype || undefined,
        sizeBytes: file.size,
      },
      user,
    );
  }

  async downloadUrl(
    id: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    await this.findScoped(id, user); // authorise access to the document
    const file = await this.em.findOne(DocumentFileEntity, {
      id: fileId,
      document: id,
    });
    if (!file) throw new NotFoundException("File not found");
    const url = await this.storage.presignDownload(
      file.storageKey,
      file.fileName,
    );
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
    await this.findScoped(id, user);
    const file = await this.em.findOne(DocumentFileEntity, {
      id: fileId,
      document: id,
    });
    if (!file) throw new NotFoundException("File not found");

    if (file.previewStatus === FilePreviewStatus.Ready && file.previewStorageKey) {
      const url = await this.storage.presignDownload(
        file.previewStorageKey,
        `${file.fileName}.pdf`,
        { disposition: "inline" },
      );
      return { url, mode: "converted", previewStatus: file.previewStatus };
    }
    if (isNativePreviewable(file.mimeType, file.fileName)) {
      const url = await this.storage.presignDownload(file.storageKey, file.fileName, {
        disposition: "inline",
      });
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
    await this.findScoped(id, user);
    const file = await this.em.findOne(DocumentFileEntity, {
      id: fileId,
      document: id,
    });
    if (!file) throw new NotFoundException("File not found");
    if (!isZipMime(file.mimeType, file.fileName)) {
      throw new BadRequestException("File is not a zip archive");
    }
    return { entries: await listZipEntriesFromSource(this.zipSource(file.storageKey)) };
  }

  async zipEntryUrl(
    id: string,
    fileId: string,
    entryPath: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    await this.findScoped(id, user);
    const file = await this.em.findOne(DocumentFileEntity, {
      id: fileId,
      document: id,
    });
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

  async addParticipant(
    id: string,
    dto: AddDocumentParticipantDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user);
    const participant = await this.em.findOne(UserEntity, { id: dto.userId });
    if (!participant) throw new NotFoundException("User not found");
    const existing = await this.em.findOne(DocumentParticipantEntity, {
      document: id,
      user: dto.userId,
    });
    if (existing) {
      existing.participantRole = dto.participantRole;
    } else {
      this.em.create(DocumentParticipantEntity, {
        document: doc,
        user: participant,
        participantRole: dto.participantRole,
        addedBy: this.em.getReference(UserEntity, user.userId),
      });
    }
    await this.em.flush();
    return this.getOne(id, user);
  }

  async removeParticipant(
    id: string,
    participantUserId: string,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    await this.findScoped(id, user);
    const existing = await this.em.findOne(DocumentParticipantEntity, {
      document: id,
      user: participantUserId,
    });
    if (!existing)
      throw new NotFoundException("Participant not found on this document");
    await this.em.removeAndFlush(existing);
    return this.getOne(id, user);
  }

  async setStatus(
    id: string,
    dto: SetDocumentStatusDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    // Sign-off is a privileged decision.
    if (
      dto.status === DocumentStatus.SignedOff &&
      !hasPermission(user.role, "review:signoff", user.partnerDesignation)
    ) {
      throw new ForbiddenException(
        "Only a Super Admin may sign off a document",
      );
    }
    const doc = await this.findScoped(id, user);
    if (doc.status === dto.status)
      throw new ConflictException(`Document is already ${dto.status}`);
    doc.status = dto.status;
    this.outbox.enqueue(EVENT.DocumentStatusChanged, {
      documentId: doc.id,
      status: dto.status,
    });
    const team = await engagementTeamRecipients(this.em, doc.engagement.id);
    await this.notifications.emit({
      recipients: team,
      type: "document.status_changed",
      title: `Document status: ${dto.status}`,
      body: doc.title,
      entityType: "document",
      entityId: doc.id,
      link: `/engagements/${doc.engagement.id}`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }
}
