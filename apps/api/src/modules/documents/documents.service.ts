import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  DocumentCategory,
  DocumentStatus,
  EVENT,
  hasPermission,
  ReportReviewState,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { OutboxService } from '../outbox/outbox.service';
import { DocumentEntity } from './infrastructure/persistence/document.entity';
import { DocumentFileEntity } from './infrastructure/persistence/document-file.entity';
import { DocumentParticipantEntity } from './infrastructure/persistence/document-participant.entity';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { EngagementRequestClassEntity } from '../engagements/infrastructure/persistence/engagement-request-class.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type {
  AddDocumentParticipantDto,
  ConfirmUploadDto,
  CreateDocumentDto,
  DocumentListQueryDto,
  PresignUploadDto,
  SetDocumentStatusDto,
  UpdateDocumentDto,
} from './presentation/dto/document.dto';
import {
  DocumentDetailResponseDto,
  DocumentResponseDto,
  PresignedUploadResponseDto,
} from './presentation/dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** Where-clause for a document under the caller's access scope. */
  private scopedWhere(id: string, user?: AuthenticatedUser): Record<string, unknown> {
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
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  private toDto(d: DocumentEntity): DocumentResponseDto {
    return {
      id: d.id,
      engagementId: d.engagement.id,
      requestClassId: d.requestClass.id,
      requestClassName: d.requestClass.name ?? null,
      requestId: d.request ? d.request.id : null,
      departmentId: d.department.id,
      category: d.category,
      title: d.title,
      description: d.description ?? null,
      status: d.status,
      currentVersion: d.currentVersion,
      createdAt: d.createdAt,
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
    if (!engagement) throw new NotFoundException('Engagement not found or not accessible');
    return engagement;
  }

  async create(dto: CreateDocumentDto, user: AuthenticatedUser): Promise<DocumentDetailResponseDto> {
    // Final reports may be created/uploaded by Super Admin only.
    if (
      dto.category === DocumentCategory.FinalReport &&
      !hasPermission(user.role, 'final-report:upload', user.partnerDesignation)
    ) {
      throw new ForbiddenException('Only a Super Admin may create a final report');
    }

    const engagement = await this.accessibleEngagement(dto.engagementId, user);

    const inScope = await this.em.findOne(EngagementRequestClassEntity, {
      engagement: dto.engagementId,
      requestClass: dto.requestClassId,
    });
    if (!inScope) {
      throw new BadRequestException('request class is not in scope for this engagement — add it first');
    }

    let request: RequestEntity | null = null;
    if (dto.requestId) {
      request = await this.em.findOne(RequestEntity, { id: dto.requestId, engagement: dto.engagementId });
      if (!request) throw new BadRequestException('Request does not belong to this engagement');
    }

    const doc = this.em.create(DocumentEntity, {
      engagement,
      requestClass: this.em.getReference(RequestClassEntity, dto.requestClassId),
      request,
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
    this.outbox.enqueue(EVENT.DocumentCreated, { documentId: doc.id, category: doc.category });
    await this.em.persistAndFlush(doc);
    return this.getOne(doc.id, user);
  }

  async list(query: DocumentListQueryDto, user?: AuthenticatedUser): Promise<Paginated<DocumentResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.requestClassId) where.requestClass = query.requestClassId;
    if (query.requestId) where.request = query.requestId;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.q) where.title = { $ilike: `%${query.q}%` };

    const engWhere: Record<string, unknown> = { ...engagementScopeWhere(resolveScope(user)) };
    if (query.engagementId) engWhere.id = query.engagementId;
    if (Object.keys(engWhere).length) where.engagement = engWhere;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(DocumentEntity, where as FilterQuery<DocumentEntity>, {
      populate: ['requestClass', 'request', 'department'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((d) => this.toDto(d)), total, page, pageSize);
  }

  async getOne(id: string, user?: AuthenticatedUser): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user, [
      'requestClass',
      'request',
      'department',
      'files',
      'participants.user',
    ]);
    return this.toDetailDto(doc);
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user);
    if (dto.title != null) doc.title = dto.title;
    if (dto.description !== undefined) doc.description = dto.description ?? null;
    await this.em.flush();
    return this.getOne(id, user);
  }

  /** Step 1 of upload: get a presigned URL to PUT the bytes to (no DB write). */
  async presignUpload(
    id: string,
    dto: PresignUploadDto,
    user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto> {
    const doc = await this.findScoped(id, user);
    const presigned = await this.storage.presignUpload({
      keyPrefix: `documents/${doc.engagement.id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
    return { ...presigned };
  }

  /** Step 2: confirm the upload → new versioned file row + status/version bump + event. */
  async confirmUpload(
    id: string,
    dto: ConfirmUploadDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user);
    const version = doc.currentVersion + 1;
    const file = this.em.create(DocumentFileEntity, {
      document: doc,
      version,
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null,
      uploadedBy: this.em.getReference(UserEntity, user.userId),
    });
    doc.currentVersion = version;
    if (doc.status === DocumentStatus.Draft) doc.status = DocumentStatus.Ready;
    this.outbox.enqueue(EVENT.DocumentFileUploaded, { documentId: doc.id, fileId: file.id, version });
    await this.em.persistAndFlush(file);
    return this.getOne(id, user);
  }

  async downloadUrl(id: string, fileId: string, user: AuthenticatedUser): Promise<{ url: string }> {
    await this.findScoped(id, user); // authorise access to the document
    const file = await this.em.findOne(DocumentFileEntity, { id: fileId, document: id });
    if (!file) throw new NotFoundException('File not found');
    const url = await this.storage.presignDownload(file.storageKey, file.fileName);
    return { url };
  }

  async addParticipant(
    id: string,
    dto: AddDocumentParticipantDto,
    user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    const doc = await this.findScoped(id, user);
    const participant = await this.em.findOne(UserEntity, { id: dto.userId });
    if (!participant) throw new NotFoundException('User not found');
    const existing = await this.em.findOne(DocumentParticipantEntity, { document: id, user: dto.userId });
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
    if (!existing) throw new NotFoundException('Participant not found on this document');
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
      !hasPermission(user.role, 'review:signoff', user.partnerDesignation)
    ) {
      throw new ForbiddenException('Only a Super Admin may sign off a document');
    }
    const doc = await this.findScoped(id, user);
    if (doc.status === dto.status) throw new ConflictException(`Document is already ${dto.status}`);
    doc.status = dto.status;
    this.outbox.enqueue(EVENT.DocumentStatusChanged, { documentId: doc.id, status: dto.status });
    await this.em.flush();
    return this.getOne(id, user);
  }
}
