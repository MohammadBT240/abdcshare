import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { phaseForStatus, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { RequestEntity } from './infrastructure/persistence/request.entity';
import { RequestAssigneeEntity } from './infrastructure/persistence/request-assignee.entity';
import { RequestHistoryEntity } from './infrastructure/persistence/request-history.entity';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { EngagementRequestClassEntity } from '../engagements/infrastructure/persistence/engagement-request-class.entity';
import { EngagementTeamMemberEntity } from '../engagements/infrastructure/persistence/engagement-team-member.entity';
import { RequestTypeEntity } from '../request-types/infrastructure/persistence/request-type.entity';
import { RequestStageEntity } from '../request-stages/infrastructure/persistence/request-stage.entity';
import { RequestStatusEntity } from '../request-statuses/infrastructure/persistence/request-status.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AssignRequestDto,
  CreateRequestDto,
  RequestListQueryDto,
  SetStageDto,
  SetStatusDto,
  UpdateRequestDto,
} from './presentation/dto/request.dto';
import { RequestDetailResponseDto, RequestResponseDto } from './presentation/dto/request.dto';

export const REQUEST_EVENT = {
  Created: 'Created',
  Updated: 'Updated',
  StageChanged: 'StageChanged',
  StatusChanged: 'StatusChanged',
  Assigned: 'Assigned',
  Unassigned: 'Unassigned',
} as const;

@Injectable()
export class RequestsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
  ) {}

  private writeHistory(
    request: RequestEntity,
    actorId: string,
    eventType: string,
    opts: { fromValue?: string | null; toValue?: string | null; note?: string | null } = {},
  ): void {
    this.em.create(RequestHistoryEntity, {
      request,
      actor: this.em.getReference(UserEntity, actorId),
      eventType,
      module: 'requests',
      fromValue: opts.fromValue ?? null,
      toValue: opts.toValue ?? null,
      note: opts.note ?? null,
    });
  }

  /** Where-clause for a single request under the caller's access scope. */
  private scopedWhere(id: string, user?: AuthenticatedUser): Record<string, unknown> {
    const eng = engagementScopeWhere(resolveScope(user));
    return Object.keys(eng).length ? { id, engagement: eng } : { id };
  }

  /** Load a request the caller is allowed to see, or 404 (existence not leaked). */
  private async findScoped(
    id: string,
    user: AuthenticatedUser | undefined,
    populate?: string[],
  ): Promise<RequestEntity> {
    const request = await this.em.findOne(
      RequestEntity,
      this.scopedWhere(id, user) as FilterQuery<RequestEntity>,
      populate ? { populate: populate as never } : undefined,
    );
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  private toDto(r: RequestEntity): RequestResponseDto {
    const requestClass = r.requestType.requestClass;
    return {
      id: r.id,
      engagementId: r.engagement.id,
      requestTypeId: r.requestType.id,
      requestTypeName: r.requestType.name ?? null,
      requestClassId: requestClass.id,
      requestClassName: requestClass.name ?? null,
      stageId: r.stage ? r.stage.id : null,
      stageName: r.stage ? r.stage.name : null,
      statusId: r.status ? r.status.id : null,
      statusName: r.status ? r.status.name : null,
      phase: r.phase ?? null,
      description: r.description,
      dueDate: r.dueDate ?? null,
      createdAt: r.createdAt,
    };
  }

  private toDetailDto(r: RequestEntity): RequestDetailResponseDto {
    return {
      ...this.toDto(r),
      assignees: r.assignees.getItems().map((a) => ({ userId: a.user.id, fullName: a.user.fullName })),
    };
  }

  /** Lowest-sortOrder active stage/status — the default a new request opens in. */
  private async firstStage(): Promise<RequestStageEntity | null> {
    const [row] = await this.em.find(
      RequestStageEntity,
      { isActive: true },
      { orderBy: { sortOrder: 'asc', id: 'asc' }, limit: 1 },
    );
    return row ?? null;
  }

  private async firstStatus(): Promise<RequestStatusEntity | null> {
    const [row] = await this.em.find(
      RequestStatusEntity,
      { isActive: true },
      { orderBy: { sortOrder: 'asc', id: 'asc' }, limit: 1 },
    );
    return row ?? null;
  }

  async create(dto: CreateRequestDto, user: AuthenticatedUser): Promise<RequestDetailResponseDto> {
    const userId = user.userId;
    const engagement = await this.em.findOne(EngagementEntity, { id: dto.engagementId });
    if (!engagement) throw new NotFoundException('Engagement not found');

    // Staff may only raise requests on engagements they're attached to.
    const scope = resolveScope(user);
    if (scope.kind === 'staff') {
      const member = await this.em.findOne(EngagementTeamMemberEntity, {
        engagement: dto.engagementId,
        user: scope.userId,
      });
      if (!member) throw new ForbiddenException('You are not attached to this engagement');
    }

    const requestType = await this.em.findOne(
      RequestTypeEntity,
      { id: dto.requestTypeId },
      { populate: ['requestClass'] },
    );
    if (!requestType) throw new NotFoundException('Request type not found');

    // Enforce the core rule: the type's request class must be in the engagement's scope.
    const inScope = await this.em.findOne(EngagementRequestClassEntity, {
      engagement: dto.engagementId,
      requestClass: requestType.requestClass.id,
    });
    if (!inScope) {
      throw new BadRequestException(
        `request class "${requestType.requestClass.name}" is not in scope for this engagement — add it first`,
      );
    }

    const stage = dto.stageId
      ? await this.em.findOne(RequestStageEntity, { id: dto.stageId })
      : await this.firstStage();
    if (!stage) throw new BadRequestException('No request stage available — configure stages first');
    const status = dto.statusId
      ? await this.em.findOne(RequestStatusEntity, { id: dto.statusId })
      : await this.firstStatus();
    if (!status) throw new BadRequestException('No request status available — configure statuses first');

    const request = this.em.create(RequestEntity, {
      engagement,
      requestType,
      stage,
      status,
      phase: dto.phase ?? phaseForStatus(engagement.status),
      description: dto.description,
      dueDate: dto.dueDate ?? null,
      createdBy: this.em.getReference(UserEntity, userId),
    });

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const unique = [...new Set(dto.assigneeIds)];
      const found = await this.em.count(UserEntity, { id: { $in: unique } });
      if (found !== unique.length) throw new NotFoundException('One or more assignees not found');
      for (const assigneeId of unique) {
        this.em.create(RequestAssigneeEntity, {
          request,
          user: this.em.getReference(UserEntity, assigneeId),
          assignedBy: this.em.getReference(UserEntity, userId),
        });
      }
    }

    this.writeHistory(request, userId, REQUEST_EVENT.Created, { note: 'Request created' });
    await this.em.persistAndFlush(request);
    return this.getOne(request.id);
  }

  async list(
    query: RequestListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<RequestResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.requestClassId) where.requestType = { requestClass: query.requestClassId };
    if (query.stageId) where.stage = query.stageId;
    if (query.statusId) where.status = query.statusId;
    if (query.phase) where.phase = query.phase;
    if (query.assigneeId) where.assignees = { user: query.assigneeId };
    if (query.q) where.description = { $ilike: `%${query.q}%` };
    // Row-level scope (Client → own engagements; Staff → engagements they're on)
    // merged with an optional engagementId filter, both nested under `engagement`.
    const engWhere: Record<string, unknown> = { ...engagementScopeWhere(resolveScope(user)) };
    if (query.engagementId) engWhere.id = query.engagementId;
    if (Object.keys(engWhere).length) where.engagement = engWhere;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(RequestEntity, where as FilterQuery<RequestEntity>, {
      populate: ['requestType.requestClass', 'stage', 'status'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  async getOne(id: string, user?: AuthenticatedUser): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user, [
      'requestType.requestClass',
      'stage',
      'status',
      'assignees.user',
    ]);
    return this.toDetailDto(request);
  }

  async update(
    id: string,
    dto: UpdateRequestDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user);
    if (dto.description != null) request.description = dto.description;
    if (dto.dueDate !== undefined) request.dueDate = dto.dueDate ?? null;
    this.writeHistory(request, user.userId, REQUEST_EVENT.Updated);
    await this.em.flush();
    return this.getOne(id, user);
  }

  async setStage(
    id: string,
    dto: SetStageDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user, ['stage']);
    const stage = await this.em.findOne(RequestStageEntity, { id: dto.stageId });
    if (!stage) throw new NotFoundException('Request stage not found');
    const fromValue = request.stage ? request.stage.name : null;
    request.stage = stage;
    this.writeHistory(request, user.userId, REQUEST_EVENT.StageChanged, {
      fromValue,
      toValue: stage.name,
      note: dto.note ?? null,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async setStatus(
    id: string,
    dto: SetStatusDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user, ['status']);
    const status = await this.em.findOne(RequestStatusEntity, { id: dto.statusId });
    if (!status) throw new NotFoundException('Request status not found');
    const fromValue = request.status ? request.status.name : null;
    request.status = status;
    this.writeHistory(request, user.userId, REQUEST_EVENT.StatusChanged, {
      fromValue,
      toValue: status.name,
      note: dto.note ?? null,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async assign(
    id: string,
    dto: AssignRequestDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user);
    const assignee = await this.em.findOne(UserEntity, { id: dto.userId });
    if (!assignee) throw new NotFoundException('User not found');
    const existing = await this.em.findOne(RequestAssigneeEntity, { request: id, user: dto.userId });
    if (existing) throw new ConflictException('User is already assigned to this request');
    this.em.create(RequestAssigneeEntity, {
      request,
      user: assignee,
      assignedBy: this.em.getReference(UserEntity, user.userId),
    });
    this.writeHistory(request, user.userId, REQUEST_EVENT.Assigned, { toValue: assignee.fullName });
    await this.notifications.emit({
      recipients: [{ userId: assignee.id, email: assignee.email ?? null }],
      type: 'request.assigned',
      title: 'You were assigned to a request',
      body: request.description?.slice(0, 140),
      entityType: 'request',
      entityId: id,
      link: `/requests/${id}`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async unassign(
    id: string,
    assigneeUserId: string,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user);
    const existing = await this.em.findOne(
      RequestAssigneeEntity,
      { request: id, user: assigneeUserId },
      { populate: ['user'] },
    );
    if (!existing) throw new NotFoundException('User is not assigned to this request');
    this.writeHistory(request, user.userId, REQUEST_EVENT.Unassigned, {
      fromValue: existing.user.fullName,
    });
    await this.em.remove(existing).flush();
    return this.getOne(id, user);
  }
}
