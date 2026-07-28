import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { SubmissionStatus, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { ClientSubmissionEntity } from './infrastructure/persistence/client-submission.entity';
import { SubmissionFileEntity } from './infrastructure/persistence/submission-file.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type {
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionFileConfirmDto,
  SubmissionFilePresignDto,
  SubmissionListQueryDto,
} from './presentation/dto/submission.dto';
import { SubmissionResponseDto } from './presentation/dto/submission.dto';

const SUBMISSION_POPULATE = ['request', 'submittedBy', 'reviewedBy', 'files'] as const;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /** `where` for a request under the caller's scope (own client / own engagements). */
  private requestScopeWhere(requestId: string, user?: AuthenticatedUser): Record<string, unknown> {
    const eng = engagementScopeWhere(resolveScope(user));
    return Object.keys(eng).length ? { id: requestId, engagement: eng } : { id: requestId };
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
      })),
      createdAt: s.createdAt,
    };
  }

  /** Load a submission the caller can access (own client / own engagements). */
  private async loadScoped(id: string, user: AuthenticatedUser): Promise<ClientSubmissionEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where = Object.keys(eng).length ? { id, request: { engagement: eng } } : { id };
    const submission = await this.em.findOne(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
    );
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  /** Presign an upload for a file to attach to a submission (client). */
  async presignFile(id: string, dto: SubmissionFilePresignDto, user: AuthenticatedUser) {
    await this.loadScoped(id, user);
    return this.storage.presignUpload({
      keyPrefix: `submissions/${id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  /** Confirm an uploaded file onto a submission (only while it's still Pending). */
  async confirmFile(
    id: string,
    dto: SubmissionFileConfirmDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.loadScoped(id, user);
    if (submission.status !== SubmissionStatus.Pending) {
      throw new BadRequestException('Cannot attach files to an already-reviewed submission');
    }
    this.em.create(SubmissionFileEntity, {
      submission,
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null,
      status: SubmissionStatus.Pending,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  /** A client responds to a request. Opens Pending, awaiting staff review. */
  async create(
    requestId: string,
    dto: CreateSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    // A client may only respond to requests on its own engagements.
    const request = await this.em.findOne(
      RequestEntity,
      this.requestScopeWhere(requestId, user) as FilterQuery<RequestEntity>,
      { populate: ['engagement.team.user'] },
    );
    if (!request) throw new NotFoundException('Request not found');
    const submission = this.em.create(ClientSubmissionEntity, {
      request,
      submittedBy: this.em.getReference(UserEntity, user.userId),
      message: dto.message,
      status: SubmissionStatus.Pending,
    });

    // Notify the engagement's staff that the client responded.
    const staff: NotifyRecipient[] = request.engagement.team
      .getItems()
      .map((tm) => ({ userId: tm.user.id, email: tm.user.email ?? null }));
    await this.notifications.emit({
      recipients: staff,
      type: 'submission.created',
      title: 'A client responded to a request',
      body: dto.message.slice(0, 140),
      entityType: 'request',
      entityId: requestId,
      link: `/requests/${requestId}`,
      excludeUserId: user.userId,
    });

    await this.em.persistAndFlush(submission);
    return this.getOne(submission.id);
  }

  async list(
    requestId: string,
    query: SubmissionListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<SubmissionResponseDto>> {
    const where: Record<string, unknown> = { request: this.requestScopeWhere(requestId, user) };
    if (query.status) where.status = query.status;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
      {
        populate: [...SUBMISSION_POPULATE],
        orderBy: { createdAt: 'desc', id: 'asc' },
        limit,
        offset,
      },
    );
    return paginated(rows.map((s) => this.toDto(s)), total, page, pageSize);
  }

  async getOne(id: string, user?: AuthenticatedUser): Promise<SubmissionResponseDto> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where = Object.keys(eng).length ? { id, request: { engagement: eng } } : { id };
    const submission = await this.em.findOne(ClientSubmissionEntity, where as FilterQuery<ClientSubmissionEntity>, {
      populate: [...SUBMISSION_POPULATE],
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return this.toDto(submission);
  }

  /** Staff accepts or returns a pending submission (scoped to their engagements). */
  async review(
    id: string,
    dto: ReviewSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const eng = engagementScopeWhere(resolveScope(user));
    const where = Object.keys(eng).length ? { id, request: { engagement: eng } } : { id };
    const submission = await this.em.findOne(
      ClientSubmissionEntity,
      where as FilterQuery<ClientSubmissionEntity>,
      { populate: ['submittedBy', 'request'] },
    );
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== SubmissionStatus.Pending) {
      throw new BadRequestException(`Submission already reviewed (${submission.status})`);
    }
    submission.status = dto.decision;
    submission.reviewedBy = this.em.getReference(UserEntity, user.userId);
    submission.reviewReason = dto.reason ?? null;
    submission.reviewedAt = new Date();

    // Notify the client contact of the accept/return decision.
    await this.notifications.emit({
      recipients: [{ userId: submission.submittedBy.id, email: submission.submittedBy.email ?? null }],
      type: 'submission.reviewed',
      title: `Your response was ${dto.decision === SubmissionStatus.Accepted ? 'accepted' : 'returned'}`,
      body: dto.reason,
      entityType: 'request',
      entityId: submission.request.id,
      link: `/requests/${submission.request.id}`,
      excludeUserId: user.userId,
    });

    await this.em.flush();
    return this.getOne(id, user);
  }
}
