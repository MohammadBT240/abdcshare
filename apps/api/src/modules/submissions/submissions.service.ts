import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { SubmissionStatus, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { NotificationsService, type NotifyRecipient } from '../notifications/notifications.service';
import { ClientSubmissionEntity } from './infrastructure/persistence/client-submission.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type {
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionListQueryDto,
} from './presentation/dto/submission.dto';
import { SubmissionResponseDto } from './presentation/dto/submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
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
      createdAt: s.createdAt,
    };
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
        populate: ['request', 'submittedBy', 'reviewedBy'],
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
      populate: ['request', 'submittedBy', 'reviewedBy'],
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
