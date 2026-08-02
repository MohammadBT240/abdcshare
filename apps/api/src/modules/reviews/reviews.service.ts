import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { ReviewStatus, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewEntity } from './infrastructure/persistence/review.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type {
  DecideReviewDto,
  ReviewListQueryDto,
  SubmitReviewDto,
} from './presentation/dto/review.dto';
import { ReviewResponseDto } from './presentation/dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
  ) {}

  private toDto(r: ReviewEntity): ReviewResponseDto {
    return {
      id: r.id,
      requestId: r.request ? r.request.id : null,
      documentId: r.document ? r.document.id : null,
      preparerId: r.preparer.id,
      preparerName: r.preparer.fullName ?? null,
      reviewerId: r.reviewer ? r.reviewer.id : null,
      reviewerName: r.reviewer ? r.reviewer.fullName ?? null : null,
      status: r.status,
      notes: r.notes ?? null,
      submittedAt: r.submittedAt,
      decidedAt: r.decidedAt ?? null,
    };
  }

  private engWhere(user: AuthenticatedUser): Record<string, unknown> {
    return engagementScopeWhere(resolveScope(user));
  }

  /** Ensure the caller can access the target request, returning it. */
  private async assertRequest(requestId: string, user: AuthenticatedUser): Promise<RequestEntity> {
    const eng = this.engWhere(user);
    const where = (Object.keys(eng).length ? { id: requestId, engagement: eng } : { id: requestId }) as FilterQuery<RequestEntity>;
    const req = await this.em.findOne(RequestEntity, where);
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  private async assertDocument(documentId: string, user: AuthenticatedUser): Promise<DocumentEntity> {
    const eng = this.engWhere(user);
    const where = (Object.keys(eng).length ? { id: documentId, engagement: eng } : { id: documentId }) as FilterQuery<DocumentEntity>;
    const doc = await this.em.findOne(DocumentEntity, where);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async submit(dto: SubmitReviewDto, user: AuthenticatedUser): Promise<ReviewResponseDto> {
    if (!dto.requestId === !dto.documentId) {
      throw new BadRequestException('Provide exactly one of requestId or documentId');
    }
    const request = dto.requestId ? await this.assertRequest(dto.requestId, user) : null;
    const document = dto.documentId ? await this.assertDocument(dto.documentId, user) : null;

    let reviewer: UserEntity | null = null;
    if (dto.reviewerId) {
      reviewer = await this.em.findOne(UserEntity, { id: dto.reviewerId });
      if (!reviewer) throw new NotFoundException('Reviewer not found');
    }

    const review = this.em.create(ReviewEntity, {
      request,
      document,
      preparer: this.em.getReference(UserEntity, user.userId),
      reviewer,
      status: ReviewStatus.ForReview,
      notes: dto.notes ?? null,
      submittedAt: new Date(),
    });

    if (reviewer) {
      await this.notifications.emit({
        recipients: [{ userId: reviewer.id, email: reviewer.email ?? null }],
        type: 'review.requested',
        title: 'A review was assigned to you',
        body: dto.notes ?? 'Please review the submitted work.',
        entityType: dto.requestId ? 'request' : 'document',
        entityId: dto.requestId ?? dto.documentId,
        excludeUserId: user.userId,
      });
    }
    await this.em.persistAndFlush(review);
    return this.getOne(review.id, user);
  }

  async decide(id: string, dto: DecideReviewDto, user: AuthenticatedUser): Promise<ReviewResponseDto> {
    const review = await this.loadScoped(id, user, ['preparer', 'request', 'document']);
    if (review.status !== ReviewStatus.ForReview) {
      throw new BadRequestException(`Review already decided (${review.status})`);
    }
    review.status = dto.decision;
    review.decidedAt = new Date();
    if (dto.notes != null) review.notes = dto.notes;
    if (dto.decision === ReviewStatus.SentBack) {
      review.sentFrom = this.em.getReference(UserEntity, user.userId);
    }
    await this.notifications.emit({
      recipients: [{ userId: review.preparer.id, email: review.preparer.email ?? null }],
      type: 'review.decided',
      title: `Your work was ${dto.decision === ReviewStatus.Approved ? 'approved' : 'sent back'}`,
      body: dto.notes,
      entityType: review.request ? 'request' : 'document',
      entityId: review.request ? review.request.id : review.document?.id,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async list(query: ReviewListQueryDto, user: AuthenticatedUser): Promise<Paginated<ReviewResponseDto>> {
    if (query.requestId) await this.assertRequest(query.requestId, user);
    if (query.documentId) await this.assertDocument(query.documentId, user);

    const where: Record<string, unknown> = {};
    if (query.requestId) where.request = query.requestId;
    if (query.documentId) where.document = query.documentId;
    if (!query.requestId && !query.documentId) where.reviewer = user.userId;
    if (query.status) where.status = query.status;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(ReviewEntity, where as FilterQuery<ReviewEntity>, {
      populate: ['preparer', 'reviewer', 'request', 'document'],
      orderBy: { submittedAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  private async loadScoped(
    id: string,
    user: AuthenticatedUser,
    populate: string[],
  ): Promise<ReviewEntity> {
    const review = await this.em.findOne(ReviewEntity, { id }, { populate: populate as never });
    if (!review) throw new NotFoundException('Review not found');
    // Re-check access via the underlying request/document.
    if (review.request) await this.assertRequest(review.request.id, user);
    else if (review.document) await this.assertDocument(review.document.id, user);
    return review;
  }

  async getOne(id: string, user: AuthenticatedUser): Promise<ReviewResponseDto> {
    const review = await this.loadScoped(id, user, ['preparer', 'reviewer', 'request', 'document']);
    return this.toDto(review);
  }
}
