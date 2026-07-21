import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  ENGAGEMENT_TRANSITIONS,
  EngagementStatus,
  type EngagementMemberRole,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementStatusHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';
import { EngagementTypeEntity } from '../engagement-types/infrastructure/persistence/engagement-type.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type {
  AddRequestClassDto,
  AddTeamMemberDto,
  CreateEngagementDto,
  EngagementListQueryDto,
  TransitionEngagementDto,
  UpdateEngagementDto,
} from './presentation/dto/engagement.dto';
import {
  EngagementDetailResponseDto,
  EngagementResponseDto,
} from './presentation/dto/engagement.dto';

@Injectable()
export class EngagementsService {
  constructor(private readonly em: EntityManager) {}

  private toDto(e: EngagementEntity): EngagementResponseDto {
    return {
      id: e.id,
      referenceCode: e.referenceCode,
      clientId: e.client.id,
      clientName: e.client.name ?? null,
      engagementTypeId: e.engagementType.id,
      engagementTypeName: e.engagementType.name ?? null,
      departmentId: e.department.id,
      departmentName: e.department.name ?? null,
      title: e.title,
      periodLabel: e.periodLabel ?? null,
      status: e.status,
      startDate: e.startDate ?? null,
      targetCompletionDate: e.targetCompletionDate ?? null,
      completedAt: e.completedAt ?? null,
      createdAt: e.createdAt,
    };
  }

  private toDetailDto(e: EngagementEntity): EngagementDetailResponseDto {
    return {
      ...this.toDto(e),
      team: e.team.getItems().map((tm) => ({
        userId: tm.user.id,
        fullName: tm.user.fullName,
        memberRole: tm.memberRole,
      })),
      requestClasses: e.requestClasses
        .getItems()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((fl) => ({ requestClassId: fl.requestClass.id, name: fl.requestClass.name, sortOrder: fl.sortOrder })),
    };
  }

  /** `ENG-{year}-{0001}` — sequential within the calendar year. */
  private async generateReferenceCode(): Promise<string> {
    const prefix = `ENG-${new Date().getFullYear()}-`;
    const count = await this.em.count(EngagementEntity, {
      referenceCode: { $like: `${prefix}%` },
    } as FilterQuery<EngagementEntity>);
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateEngagementDto, userId: string): Promise<EngagementDetailResponseDto> {
    const client = await this.em.findOne(ClientEntity, { id: dto.clientId });
    if (!client) throw new NotFoundException('Client not found');
    const engagementType = await this.em.findOne(EngagementTypeEntity, { id: dto.engagementTypeId });
    if (!engagementType) throw new NotFoundException('Engagement type not found');
    const department = await this.em.findOne(DepartmentEntity, { id: dto.departmentId });
    if (!department) throw new NotFoundException('Department not found');

    const engagement = this.em.create(EngagementEntity, {
      client,
      engagementType,
      department,
      referenceCode: await this.generateReferenceCode(),
      title: dto.title,
      periodLabel: dto.periodLabel ?? null,
      status: EngagementStatus.Planning,
      startDate: dto.startDate ?? null,
      targetCompletionDate: dto.targetCompletionDate ?? null,
      createdBy: this.em.getReference(UserEntity, userId),
    });

    if (dto.requestClassIds && dto.requestClassIds.length > 0) {
      const unique = [...new Set(dto.requestClassIds)];
      const found = await this.em.count(RequestClassEntity, { id: { $in: unique } });
      if (found !== unique.length) throw new NotFoundException('One or more request classes not found');
      unique.forEach((requestClassId, i) => {
        this.em.create(EngagementRequestClassEntity, {
          engagement,
          requestClass: this.em.getReference(RequestClassEntity, requestClassId),
          sortOrder: i,
          addedBy: this.em.getReference(UserEntity, userId),
        });
      });
    }

    this.em.create(EngagementStatusHistoryEntity, {
      engagement,
      fromStatus: null,
      toStatus: EngagementStatus.Planning,
      changedBy: this.em.getReference(UserEntity, userId),
      note: 'Engagement created',
    });

    await this.em.persistAndFlush(engagement);
    return this.getOne(engagement.id);
  }

  async list(
    query: EngagementListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<EngagementResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.clientId) where.client = query.clientId;
    if (query.departmentId) where.department = query.departmentId;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.$or = [
        { title: { $ilike: `%${query.q}%` } },
        { referenceCode: { $ilike: `%${query.q}%` } },
      ];
    }
    // Row-level scope: Client → own client's engagements; Staff → engagements they're on.
    Object.assign(where, engagementScopeWhere(resolveScope(user)));

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      EngagementEntity,
      where as FilterQuery<EngagementEntity>,
      {
        populate: ['client', 'engagementType', 'department'],
        orderBy: { createdAt: 'desc', id: 'asc' },
        limit,
        offset,
      },
    );
    return paginated(rows.map((e) => this.toDto(e)), total, page, pageSize);
  }

  async getOne(id: string, user?: AuthenticatedUser): Promise<EngagementDetailResponseDto> {
    const engagement = await this.em.findOne(
      EngagementEntity,
      { id, ...engagementScopeWhere(resolveScope(user)) },
      { populate: ['client', 'engagementType', 'department', 'team.user', 'requestClasses.requestClass'] },
    );
    if (!engagement) throw new NotFoundException('Engagement not found');
    return this.toDetailDto(engagement);
  }

  async update(id: string, dto: UpdateEngagementDto): Promise<EngagementDetailResponseDto> {
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    if (dto.title != null) engagement.title = dto.title;
    if (dto.periodLabel !== undefined) engagement.periodLabel = dto.periodLabel ?? null;
    if (dto.startDate !== undefined) engagement.startDate = dto.startDate ?? null;
    if (dto.targetCompletionDate !== undefined) {
      engagement.targetCompletionDate = dto.targetCompletionDate ?? null;
    }
    await this.em.flush();
    return this.getOne(id);
  }

  /** Move the engagement through its lifecycle, enforcing allowed transitions. */
  async transition(
    id: string,
    dto: TransitionEngagementDto,
    userId: string,
  ): Promise<EngagementDetailResponseDto> {
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const from = engagement.status;
    if (from === dto.toStatus) {
      throw new BadRequestException(`Engagement is already ${dto.toStatus}`);
    }
    if (!ENGAGEMENT_TRANSITIONS[from].includes(dto.toStatus)) {
      throw new BadRequestException(
        `Cannot move an engagement from ${from} to ${dto.toStatus}. Allowed: ${
          ENGAGEMENT_TRANSITIONS[from].join(', ') || 'none'
        }`,
      );
    }
    engagement.status = dto.toStatus;
    engagement.completedAt = dto.toStatus === EngagementStatus.Completed ? new Date() : null;
    this.em.create(EngagementStatusHistoryEntity, {
      engagement,
      fromStatus: from,
      toStatus: dto.toStatus,
      changedBy: this.em.getReference(UserEntity, userId),
      note: dto.note ?? null,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async addTeamMember(
    id: string,
    dto: AddTeamMemberDto,
    userId: string,
  ): Promise<EngagementDetailResponseDto> {
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const member = await this.em.findOne(UserEntity, { id: dto.userId });
    if (!member) throw new NotFoundException('User not found');

    const existing = await this.em.findOne(EngagementTeamMemberEntity, {
      engagement: id,
      user: dto.userId,
    });
    if (existing) {
      existing.memberRole = dto.memberRole as EngagementMemberRole;
    } else {
      this.em.create(EngagementTeamMemberEntity, {
        engagement,
        user: member,
        memberRole: dto.memberRole,
        assignedBy: this.em.getReference(UserEntity, userId),
      });
    }
    await this.em.flush();
    return this.getOne(id);
  }

  async removeTeamMember(id: string, memberUserId: string): Promise<EngagementDetailResponseDto> {
    const existing = await this.em.findOne(EngagementTeamMemberEntity, {
      engagement: id,
      user: memberUserId,
    });
    if (!existing) throw new NotFoundException('Team member not found on this engagement');
    await this.em.removeAndFlush(existing);
    return this.getOne(id);
  }

  async addRequestClass(id: string, dto: AddRequestClassDto, userId: string): Promise<EngagementDetailResponseDto> {
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const requestClass = await this.em.findOne(RequestClassEntity, { id: dto.requestClassId });
    if (!requestClass) throw new NotFoundException('Request class not found');

    const existing = await this.em.findOne(EngagementRequestClassEntity, {
      engagement: id,
      requestClass: dto.requestClassId,
    });
    if (existing) throw new ConflictException('request class is already in scope for this engagement');
    this.em.create(EngagementRequestClassEntity, {
      engagement,
      requestClass,
      sortOrder: dto.sortOrder ?? 0,
      addedBy: this.em.getReference(UserEntity, userId),
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async removeRequestClass(id: string, requestClassId: number): Promise<EngagementDetailResponseDto> {
    const existing = await this.em.findOne(EngagementRequestClassEntity, {
      engagement: id,
      requestClass: requestClassId,
    });
    if (!existing) throw new NotFoundException('request class is not in scope for this engagement');
    await this.em.removeAndFlush(existing);
    return this.getOne(id);
  }
}
