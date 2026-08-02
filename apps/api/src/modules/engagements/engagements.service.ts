import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import {
  ENGAGEMENT_TRANSITIONS,
  EngagementMemberRole,
  EngagementPhase,
  EngagementStage,
  EVENT,
  ReviewStatus,
  SubmissionStatus,
  type Paginated,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  engagementTeamRecipients,
  mergeRecipients,
} from '../notifications/recipient-helpers';
import {
  assertEngagementCapability,
  hasEngagementCapability,
  isEngagementLead,
} from './engagement-capabilities';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementStageHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';
import { EngagementSignOffEntity } from './infrastructure/persistence/engagement-sign-off.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';
import { EngagementTypeEntity } from '../engagement-types/infrastructure/persistence/engagement-type.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { ClientSubmissionEntity } from '../submissions/infrastructure/persistence/client-submission.entity';
import { SubmissionFileEntity } from '../submissions/infrastructure/persistence/submission-file.entity';
import { ReviewEntity } from '../reviews/infrastructure/persistence/review.entity';
import type {
  AddRequestClassDto,
  AddTeamMemberDto,
  CreateEngagementDto,
  CloneEngagementDto,
  CreateSignOffDto,
  EngagementListQueryDto,
  RevokeSignOffDto,
  TransitionEngagementDto,
  UpdateEngagementDto,
} from './presentation/dto/engagement.dto';
import {
  EngagementDetailResponseDto,
  EngagementHistoryItemDto,
  EngagementListItemDto,
  EngagementResponseDto,
  EngagementWorkspaceResponseDto,
  SignOffResponseDto,
} from './presentation/dto/engagement.dto';

/** Request status names that count as “done” for progress rollups. */
const DONE_STATUS_NAMES = new Set(['Accepted', 'Closed']);

@Injectable()
export class EngagementsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
  ) {}

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
      stage: e.stage,
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

  private isDone(statusName: string | null | undefined): boolean {
    return statusName != null && DONE_STATUS_NAMES.has(statusName);
  }

  private isOverdue(dueDate: Date | null | undefined, statusName: string | null | undefined, now: Date): boolean {
    if (!dueDate || this.isDone(statusName)) return false;
    return dueDate < now;
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
      stage: EngagementStage.Planning,
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

    this.em.create(EngagementStageHistoryEntity, {
      engagement,
      fromStage: null,
      toStage: EngagementStage.Planning,
      changedBy: this.em.getReference(UserEntity, userId),
      note: 'Engagement created',
    });

    // Creator is the engagement Lead by default.
    this.em.create(EngagementTeamMemberEntity, {
      engagement,
      user: this.em.getReference(UserEntity, userId),
      memberRole: EngagementMemberRole.Lead,
      assignedBy: this.em.getReference(UserEntity, userId),
    });

    this.outbox.enqueue(EVENT.EngagementCreated, { engagementId: engagement.id });

    await this.em.persistAndFlush(engagement);

    const team = await engagementTeamRecipients(this.em, engagement.id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.created',
      title: `Engagement created: ${engagement.referenceCode}`,
      body: engagement.title,
      entityType: 'engagement',
      entityId: engagement.id,
      link: `/engagements/${engagement.id}`,
      excludeUserId: userId,
    });
    if (team.length > 0) await this.em.flush();

    return this.getOne(engagement.id);
  }

  async clone(
    id: string,
    dto: CloneEngagementDto,
    userId: string,
  ): Promise<EngagementDetailResponseDto> {
    const source = await this.em.findOne(
      EngagementEntity,
      { id },
      { populate: ['client', 'engagementType', 'department', 'requestClasses.requestClass'] },
    );
    if (!source) throw new NotFoundException('Engagement not found');

    const periodLabel = dto.periodLabel ?? source.periodLabel ?? null;
    const title =
      dto.periodLabel && source.periodLabel && source.title.includes(source.periodLabel)
        ? source.title.replace(source.periodLabel, dto.periodLabel)
        : source.title;
    const engagement = this.em.create(EngagementEntity, {
      client: source.client,
      engagementType: source.engagementType,
      department: source.department,
      referenceCode: await this.generateReferenceCode(),
      title,
      periodLabel,
      stage: EngagementStage.Planning,
      startDate: dto.startDate ?? null,
      targetCompletionDate: dto.targetCompletionDate ?? null,
      createdBy: this.em.getReference(UserEntity, userId),
    });

    for (const scoped of source.requestClasses.getItems()) {
      this.em.create(EngagementRequestClassEntity, {
        engagement,
        requestClass: scoped.requestClass,
        sortOrder: scoped.sortOrder,
        addedBy: this.em.getReference(UserEntity, userId),
      });
    }
    this.em.create(EngagementStageHistoryEntity, {
      engagement,
      fromStage: null,
      toStage: EngagementStage.Planning,
      changedBy: this.em.getReference(UserEntity, userId),
      note: `Cloned from ${source.referenceCode ?? source.id}`,
    });
    // Cloner becomes Lead; source team is not copied.
    this.em.create(EngagementTeamMemberEntity, {
      engagement,
      user: this.em.getReference(UserEntity, userId),
      memberRole: EngagementMemberRole.Lead,
      assignedBy: this.em.getReference(UserEntity, userId),
    });
    this.outbox.enqueue(EVENT.EngagementCreated, {
      engagementId: engagement.id,
      clonedFromEngagementId: source.id,
    });
    await this.em.persistAndFlush(engagement);
    return this.getOne(engagement.id);
  }

  async list(
    query: EngagementListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<EngagementListItemDto>> {
    const where: Record<string, unknown> = {};
    if (query.clientId) where.client = query.clientId;
    if (query.departmentId) where.department = query.departmentId;
    if (query.stage) where.stage = query.stage;
    if (query.q) {
      where.$or = [
        { title: { $ilike: `%${query.q}%` } },
        { referenceCode: { $ilike: `%${query.q}%` } },
      ];
    }
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

    const ids = rows.map((e) => e.id);
    const counts = await this.batchListCounts(ids);
    return paginated(
      rows.map((e) => ({
        ...this.toDto(e),
        requestCount: counts.requestCount.get(e.id) ?? 0,
        overdueCount: counts.overdueCount.get(e.id) ?? 0,
        teamSize: counts.teamSize.get(e.id) ?? 0,
      })),
      total,
      page,
      pageSize,
    );
  }

  private async batchListCounts(engagementIds: string[]): Promise<{
    requestCount: Map<string, number>;
    overdueCount: Map<string, number>;
    teamSize: Map<string, number>;
  }> {
    const requestCount = new Map<string, number>();
    const overdueCount = new Map<string, number>();
    const teamSize = new Map<string, number>();
    if (engagementIds.length === 0) return { requestCount, overdueCount, teamSize };

    const now = new Date();
    const [requests, members] = await Promise.all([
      this.em.find(
        RequestEntity,
        { engagement: { $in: engagementIds } } as FilterQuery<RequestEntity>,
        { populate: ['status', 'engagement'] },
      ),
      this.em.find(
        EngagementTeamMemberEntity,
        { engagement: { $in: engagementIds } } as FilterQuery<EngagementTeamMemberEntity>,
        { populate: ['engagement'] },
      ),
    ]);

    for (const r of requests) {
      const id = r.engagement.id;
      requestCount.set(id, (requestCount.get(id) ?? 0) + 1);
      if (this.isOverdue(r.dueDate, r.status?.name, now)) {
        overdueCount.set(id, (overdueCount.get(id) ?? 0) + 1);
      }
    }
    for (const m of members) {
      const id = m.engagement.id;
      teamSize.set(id, (teamSize.get(id) ?? 0) + 1);
    }
    return { requestCount, overdueCount, teamSize };
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

  async getWorkspace(id: string, user?: AuthenticatedUser): Promise<EngagementWorkspaceResponseDto> {
    const engagement = await this.em.findOne(
      EngagementEntity,
      { id, ...engagementScopeWhere(resolveScope(user)) },
      { populate: ['client', 'engagementType', 'department', 'team.user', 'requestClasses.requestClass'] },
    );
    if (!engagement) throw new NotFoundException('Engagement not found');

    const now = new Date();
    const [requests, signOffRows, submissions, underReviewCount] = await Promise.all([
      this.em.find(
        RequestEntity,
        { engagement: id } as FilterQuery<RequestEntity>,
        { populate: ['requestType.requestClass', 'status', 'stage'] },
      ),
      this.em.find(
        EngagementSignOffEntity,
        { engagement: id } as FilterQuery<EngagementSignOffEntity>,
        { populate: ['requestClass', 'signedBy'], orderBy: { signedAt: 'desc' } },
      ),
      this.em.find(
        ClientSubmissionEntity,
        { request: { engagement: id } } as FilterQuery<ClientSubmissionEntity>,
        { fields: ['id', 'status'] },
      ),
      this.em.count(ReviewEntity, {
        request: { engagement: id },
        status: ReviewStatus.ForReview,
      } as FilterQuery<ReviewEntity>),
    ]);

    const activeSignOffs = signOffRows.filter((s) => s.revokedAt == null);
    const hasEngagementWideSignOff = activeSignOffs.some((s) => s.requestClass == null);
    const signedClassIds = new Set(
      activeSignOffs.filter((s) => s.requestClass != null).map((s) => s.requestClass!.id),
    );

    const scopedClasses = engagement.requestClasses
      .getItems()
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const missingRequestClassIds = hasEngagementWideSignOff
      ? []
      : scopedClasses
          .filter((c) => !signedClassIds.has(c.requestClass.id))
          .map((c) => c.requestClass.id);

    const canComplete =
      hasEngagementWideSignOff ||
      (scopedClasses.length > 0 && missingRequestClassIds.length === 0);

    const emptyPhases = (): Record<EngagementPhase, number> => ({
      [EngagementPhase.Planning]: 0,
      [EngagementPhase.Execution]: 0,
      [EngagementPhase.Reporting]: 0,
    });

    const phaseCounts = emptyPhases();

    const byClass = new Map<
      number,
      { total: number; done: number; overdue: number; phaseCounts: Record<EngagementPhase, number> }
    >();
    for (const c of scopedClasses) {
      byClass.set(c.requestClass.id, {
        total: 0,
        done: 0,
        overdue: 0,
        phaseCounts: emptyPhases(),
      });
    }

    let overdueCount = 0;
    for (const r of requests) {
      const classId = r.requestType.requestClass.id;
      if (!byClass.has(classId)) {
        byClass.set(classId, {
          total: 0,
          done: 0,
          overdue: 0,
          phaseCounts: emptyPhases(),
        });
      }
      const bucket = byClass.get(classId)!;
      bucket.total += 1;
      if (this.isDone(r.status?.name)) bucket.done += 1;
      if (this.isOverdue(r.dueDate, r.status?.name, now)) {
        bucket.overdue += 1;
        overdueCount += 1;
      }
      if (r.phase && r.phase in phaseCounts) {
        phaseCounts[r.phase] += 1;
        bucket.phaseCounts[r.phase] += 1;
      }
    }

    const classRollups = scopedClasses.map((c) => {
      const stats = byClass.get(c.requestClass.id) ?? {
        total: 0,
        done: 0,
        overdue: 0,
        phaseCounts: emptyPhases(),
      };
      const progressPercent =
        stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
      return {
        requestClassId: c.requestClass.id,
        name: c.requestClass.name,
        total: stats.total,
        done: stats.done,
        overdue: stats.overdue,
        progressPercent,
        signedOff: hasEngagementWideSignOff || signedClassIds.has(c.requestClass.id),
        phaseCounts: stats.phaseCounts,
      };
    });

    // Engagement % = average of in-scope class percents (0 if no requests at all).
    const requestCount = requests.length;
    const progressPercent =
      requestCount === 0 || classRollups.length === 0
        ? 0
        : Math.round(
            classRollups.reduce((sum, r) => sum + r.progressPercent, 0) / classRollups.length,
          );

    const submissionIds = submissions.map((s) => s.id);
    const uploaded =
      submissionIds.length === 0
        ? 0
        : await this.em.count(SubmissionFileEntity, {
            submission: { $in: submissionIds },
          } as FilterQuery<SubmissionFileEntity>);

    let awaitingReview = 0;
    let returned = 0;
    let accepted = 0;
    for (const s of submissions) {
      if (s.status === SubmissionStatus.Pending) awaitingReview += 1;
      else if (s.status === SubmissionStatus.Returned) returned += 1;
      else if (s.status === SubmissionStatus.Accepted) accepted += 1;
    }

    const viewerIsLead = user
      ? await isEngagementLead(this.em, id, user.userId)
      : false;
    const canManageEngagement = user
      ? await hasEngagementCapability(this.em, user, id, 'manage')
      : false;
    const canTransitionEngagement = user
      ? await hasEngagementCapability(this.em, user, id, 'transition')
      : false;
    const canSignOffEngagement = user
      ? await hasEngagementCapability(this.em, user, id, 'signoff')
      : false;

    return {
      ...this.toDetailDto(engagement),
      signOffs: signOffRows.map((s) => this.signOffDto(s)),
      classRollups,
      phaseCounts,
      progressPercent,
      overdueCount,
      requestCount,
      submissionCounts: {
        uploaded,
        awaitingReview,
        returned,
        accepted,
        underReview: underReviewCount,
      },
      allowedNextStages: [...ENGAGEMENT_TRANSITIONS[engagement.stage]],
      canComplete,
      missingRequestClassIds,
      hasEngagementWideSignOff,
      viewerIsLead,
      canManageEngagement,
      canTransitionEngagement,
      canSignOffEngagement,
    };
  }

  async getHistory(id: string, user?: AuthenticatedUser): Promise<EngagementHistoryItemDto[]> {
    const engagement = await this.em.findOne(EngagementEntity, {
      id,
      ...engagementScopeWhere(resolveScope(user)),
    } as FilterQuery<EngagementEntity>);
    if (!engagement) throw new NotFoundException('Engagement not found');

    const rows = await this.em.find(
      EngagementStageHistoryEntity,
      { engagement: id } as FilterQuery<EngagementStageHistoryEntity>,
      { populate: ['changedBy'], orderBy: { changedAt: 'desc' } },
    );
    return rows.map((h) => ({
      id: h.id,
      fromStage: h.fromStage ?? null,
      toStage: h.toStage,
      changedById: h.changedBy ? h.changedBy.id : null,
      changedByName: h.changedBy ? h.changedBy.fullName : null,
      changedAt: h.changedAt,
      note: h.note ?? null,
    }));
  }

  async update(
    id: string,
    dto: UpdateEngagementDto,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
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
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'transition');
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const from = engagement.stage;
    if (from === dto.toStage) {
      throw new BadRequestException(`Engagement is already ${dto.toStage}`);
    }
    if (!ENGAGEMENT_TRANSITIONS[from].includes(dto.toStage)) {
      throw new BadRequestException(
        `Cannot move an engagement from ${from} to ${dto.toStage}. Allowed: ${
          ENGAGEMENT_TRANSITIONS[from].join(', ') || 'none'
        }`,
      );
    }
    if (dto.toStage === EngagementStage.Completed) {
      await this.assertFullySignedOff(id);
    }
    engagement.stage = dto.toStage;
    engagement.completedAt = dto.toStage === EngagementStage.Completed ? new Date() : null;
    this.em.create(EngagementStageHistoryEntity, {
      engagement,
      fromStage: from,
      toStage: dto.toStage,
      changedBy: this.em.getReference(UserEntity, user.userId),
      note: dto.note ?? null,
    });
    this.outbox.enqueue(EVENT.EngagementStageChanged, {
      engagementId: id,
      fromStage: from,
      toStage: dto.toStage,
    });
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.stage_changed',
      title: `Engagement moved to ${dto.toStage}`,
      body: `${engagement.referenceCode}: ${from} → ${dto.toStage}`,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  /**
   * Make `userId` the sole Lead; demote any previous Lead(s) to Member.
   * Target must already be on the team (or is created as Lead when adding with role Lead).
   */
  private async promoteToLead(
    engagement: EngagementEntity,
    targetUser: UserEntity,
    actorUserId: string,
  ): Promise<void> {
    const members = await this.em.find(EngagementTeamMemberEntity, {
      engagement: engagement.id,
    } as FilterQuery<EngagementTeamMemberEntity>, { populate: ['user'] });
    for (const row of members) {
      if (row.user.id === targetUser.id) {
        row.memberRole = EngagementMemberRole.Lead;
      } else if (row.memberRole === EngagementMemberRole.Lead) {
        row.memberRole = EngagementMemberRole.Member;
      }
    }
    const onTeam = members.some((m) => m.user.id === targetUser.id);
    if (!onTeam) {
      this.em.create(EngagementTeamMemberEntity, {
        engagement,
        user: targetUser,
        memberRole: EngagementMemberRole.Lead,
        assignedBy: this.em.getReference(UserEntity, actorUserId),
      });
    }
  }

  async addTeamMember(
    id: string,
    dto: AddTeamMemberDto,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const member = await this.em.findOne(UserEntity, { id: dto.userId });
    if (!member) throw new NotFoundException('User not found');

    const role = dto.memberRole ?? EngagementMemberRole.Member;
    const existing = await this.em.findOne(EngagementTeamMemberEntity, {
      engagement: id,
      user: dto.userId,
    });

    if (role === EngagementMemberRole.Lead) {
      await this.promoteToLead(engagement, member, user.userId);
    } else if (existing) {
      if (existing.memberRole === EngagementMemberRole.Lead) {
        const leadCount = await this.em.count(EngagementTeamMemberEntity, {
          engagement: id,
          memberRole: EngagementMemberRole.Lead,
        } as FilterQuery<EngagementTeamMemberEntity>);
        if (leadCount <= 1) {
          throw new BadRequestException(
            'Elevate someone else to Lead before demoting the current Lead',
          );
        }
      }
      existing.memberRole = EngagementMemberRole.Member;
    } else {
      this.em.create(EngagementTeamMemberEntity, {
        engagement,
        user: member,
        memberRole: EngagementMemberRole.Member,
        assignedBy: this.em.getReference(UserEntity, user.userId),
      });
    }

    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: mergeRecipients(team, [
        { userId: member.id, email: member.email ?? null },
      ]),
      type: 'engagement.team_changed',
      title: existing
        ? `Team role updated: ${member.fullName}`
        : `Added to engagement team: ${member.fullName}`,
      body: `${engagement.referenceCode} · ${role}`,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async elevateTeamMember(
    id: string,
    memberUserId: string,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    const member = await this.em.findOne(UserEntity, { id: memberUserId });
    if (!member) throw new NotFoundException('User not found');
    const existing = await this.em.findOne(EngagementTeamMemberEntity, {
      engagement: id,
      user: memberUserId,
    });
    if (!existing) {
      throw new NotFoundException('Team member not found on this engagement');
    }
    if (existing.memberRole === EngagementMemberRole.Lead) {
      return this.getOne(id);
    }
    await this.promoteToLead(engagement, member, user.userId);
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: mergeRecipients(team, [
        { userId: member.id, email: member.email ?? null },
      ]),
      type: 'engagement.team_changed',
      title: `Team Lead: ${member.fullName}`,
      body: engagement.referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async removeTeamMember(
    id: string,
    memberUserId: string,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
    const existing = await this.em.findOne(
      EngagementTeamMemberEntity,
      { engagement: id, user: memberUserId },
      { populate: ['user', 'engagement'] },
    );
    if (!existing) throw new NotFoundException('Team member not found on this engagement');
    if (existing.memberRole === EngagementMemberRole.Lead) {
      const leadCount = await this.em.count(EngagementTeamMemberEntity, {
        engagement: id,
        memberRole: EngagementMemberRole.Lead,
      } as FilterQuery<EngagementTeamMemberEntity>);
      if (leadCount <= 1) {
        throw new BadRequestException(
          'Elevate someone else to Lead before removing the current Lead',
        );
      }
    }
    const removed = {
      userId: existing.user.id,
      email: existing.user.email ?? null,
      fullName: existing.user.fullName,
    };
    const referenceCode = existing.engagement.referenceCode;
    await this.em.removeAndFlush(existing);
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: mergeRecipients(team, [
        { userId: removed.userId, email: removed.email },
      ]),
      type: 'engagement.team_changed',
      title: `Removed from engagement team: ${removed.fullName}`,
      body: referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async addRequestClass(
    id: string,
    dto: AddRequestClassDto,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
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
      addedBy: this.em.getReference(UserEntity, user.userId),
    });
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.class_changed',
      title: `Request class added: ${requestClass.name}`,
      body: engagement.referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  async removeRequestClass(
    id: string,
    requestClassId: number,
    user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'manage');
    const existing = await this.em.findOne(
      EngagementRequestClassEntity,
      { engagement: id, requestClass: requestClassId },
      { populate: ['requestClass', 'engagement'] },
    );
    if (!existing) throw new NotFoundException('request class is not in scope for this engagement');
    const className = existing.requestClass.name;
    const referenceCode = existing.engagement.referenceCode;
    await this.em.removeAndFlush(existing);
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.class_changed',
      title: `Request class removed: ${className}`,
      body: referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id);
  }

  // ---- Sign-offs ----------------------------------------------------------

  private signOffDto(s: EngagementSignOffEntity): SignOffResponseDto {
    return {
      id: s.id,
      requestClassId: s.requestClass ? s.requestClass.id : null,
      requestClassName: s.requestClass ? s.requestClass.name : null,
      signedById: s.signedBy.id,
      signedByName: s.signedBy.fullName ?? null,
      signedAt: s.signedAt,
      note: s.note ?? null,
      revoked: s.revokedAt != null,
      revokedAt: s.revokedAt ?? null,
    };
  }

  async listSignOffs(id: string): Promise<SignOffResponseDto[]> {
    await this.em.findOneOrFail(EngagementEntity, { id });
    const rows = await this.em.find(
      EngagementSignOffEntity,
      { engagement: id } as FilterQuery<EngagementSignOffEntity>,
      { populate: ['requestClass', 'signedBy'], orderBy: { signedAt: 'desc' } },
    );
    return rows.map((s) => this.signOffDto(s));
  }

  async signOff(
    id: string,
    dto: CreateSignOffDto,
    user: AuthenticatedUser,
  ): Promise<SignOffResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'signoff');
    const engagement = await this.em.findOneOrFail(EngagementEntity, { id });
    let requestClass = null;
    if (dto.requestClassId != null) {
      const inScope = await this.em.findOne(EngagementRequestClassEntity, {
        engagement: id,
        requestClass: dto.requestClassId,
      });
      if (!inScope) throw new BadRequestException('request class is not in scope for this engagement');
      const dup = await this.em.findOne(EngagementSignOffEntity, {
        engagement: id,
        requestClass: dto.requestClassId,
        revokedAt: null,
      });
      if (dup) throw new ConflictException('This request class is already signed off');
      requestClass = this.em.getReference(RequestClassEntity, dto.requestClassId);
    }
    const signOff = this.em.create(EngagementSignOffEntity, {
      engagement,
      requestClass,
      signedBy: this.em.getReference(UserEntity, user.userId),
      signedAt: new Date(),
      note: dto.note ?? null,
    });
    await this.em.persistAndFlush(signOff);
    const scopeLabel =
      dto.requestClassId != null
        ? (await this.em.findOne(RequestClassEntity, { id: dto.requestClassId }))?.name ??
          'request class'
        : 'entire engagement';
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.signoff',
      title: `Sign-off recorded: ${scopeLabel}`,
      body: engagement.referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    const populated = await this.em.findOneOrFail(
      EngagementSignOffEntity,
      { id: signOff.id },
      { populate: ['requestClass', 'signedBy'] },
    );
    return this.signOffDto(populated);
  }

  async revokeSignOff(
    id: string,
    signOffId: string,
    dto: RevokeSignOffDto,
    user: AuthenticatedUser,
  ): Promise<SignOffResponseDto> {
    await assertEngagementCapability(this.em, user, id, 'signoff');
    const signOff = await this.em.findOne(
      EngagementSignOffEntity,
      { id: signOffId, engagement: id },
      { populate: ['requestClass', 'signedBy', 'engagement'] },
    );
    if (!signOff) throw new NotFoundException('Sign-off not found');
    if (signOff.revokedAt) throw new BadRequestException('Sign-off already revoked');
    signOff.revokedBy = this.em.getReference(UserEntity, user.userId);
    signOff.revokedAt = new Date();
    signOff.revokeReason = dto.reason ?? null;
    const scopeLabel = signOff.requestClass?.name ?? 'entire engagement';
    const team = await engagementTeamRecipients(this.em, id);
    await this.notifications.emit({
      recipients: team,
      type: 'engagement.signoff_revoked',
      title: `Sign-off revoked: ${scopeLabel}`,
      body: signOff.engagement.referenceCode,
      entityType: 'engagement',
      entityId: id,
      link: `/engagements/${id}?tab=settings`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.signOffDto(signOff);
  }

  /**
   * Completion guard only — sign-off does not lock create/edit/upload.
   * Requires engagement-wide sign-off, or every in-scope request class signed off.
   */
  private async assertFullySignedOff(engagementId: string): Promise<void> {
    const wide = await this.em.count(EngagementSignOffEntity, {
      engagement: engagementId,
      requestClass: null,
      revokedAt: null,
    } as FilterQuery<EngagementSignOffEntity>);
    if (wide > 0) return;

    const classes = await this.em.find(EngagementRequestClassEntity, {
      engagement: engagementId,
    } as FilterQuery<EngagementRequestClassEntity>, { populate: ['requestClass'] });
    if (classes.length === 0) {
      throw new BadRequestException('Add and sign off request classes before completing the engagement');
    }
    const signed = await this.em.find(
      EngagementSignOffEntity,
      { engagement: engagementId, revokedAt: null, requestClass: { $ne: null } } as FilterQuery<EngagementSignOffEntity>,
      { populate: ['requestClass'] },
    );
    const signedIds = new Set(signed.map((s) => s.requestClass?.id));
    const missing = classes.filter((c) => !signedIds.has(c.requestClass.id)).length;
    if (missing > 0) {
      throw new BadRequestException(
        `Sign off all request classes before completing (${missing} still unsigned)`,
      );
    }
  }
}
