import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { wrap, type FilterQuery } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  computeRequestProgressPercent,
  EVENT,
  FilePreviewStatus,
  hasPermission,
  isRequestOverdue,
  phaseForStage,
  REQUEST_STAGE,
  type Paginated,
} from "@abdcshare/shared";
import { pageParams, paginated } from "../../common/pagination/paginate";
import { batchAcceptedFileCounts } from "../../common/metrics/accepted-file-counts";
import { syncInferredRequestStage } from "./request-stage-sync";
import {
  engagementScopeWhere,
  resolveScope,
} from "../../common/security/access-scope";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user";
import { STORAGE, type StoragePort } from "../../common/storage/storage.port";
import { UPLOAD_MAX_BYTES } from "../../common/storage/upload.constants";
import { presignAvatar } from "../../common/storage/presign-avatar";
import {
  initialPreviewStatus,
  isBlockedPreviewType,
  isNativePreviewable,
  isOfficeMime,
  isPreviewAllowlisted,
} from "../../common/storage/preview.util";
import { RequestEntity } from "./infrastructure/persistence/request.entity";
import { RequestAssigneeEntity } from "./infrastructure/persistence/request-assignee.entity";
import { RequestHistoryEntity } from "./infrastructure/persistence/request-history.entity";
import { EngagementEntity } from "../engagements/infrastructure/persistence/engagement.entity";
import { EngagementRequestClassEntity } from "../engagements/infrastructure/persistence/engagement-request-class.entity";
import { EngagementTeamMemberEntity } from "../engagements/infrastructure/persistence/engagement-team-member.entity";
import { RequestTypeEntity } from "../request-types/infrastructure/persistence/request-type.entity";
import { RequestStageEntity } from "../request-stages/infrastructure/persistence/request-stage.entity";
import { RequestStatusEntity } from "../request-statuses/infrastructure/persistence/request-status.entity";
import { UserEntity } from "../users/infrastructure/persistence/user.entity";
import { ClientSubmissionEntity } from "../submissions/infrastructure/persistence/client-submission.entity";
import { DocumentEntity } from "../documents/infrastructure/persistence/document.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { OutboxService } from "../outbox/outbox.service";
import {
  assigneesOrTeamRecipients,
  engagementClientContactRecipients,
  engagementTeamRecipients,
  mergeRecipients,
} from "../notifications/recipient-helpers";
import type {
  AssignRequestDto,
  BulkUpdateRequestsDto,
  ConfirmRequestBriefDto,
  CreateRequestDto,
  PresignRequestBriefDto,
  RequestListQueryDto,
  SetStageDto,
  SetStatusDto,
  UpdateRequestDto,
} from "./presentation/dto/request.dto";
import {
  RequestDetailResponseDto,
  RequestHistoryItemDto,
  RequestResponseDto,
} from "./presentation/dto/request.dto";

export const REQUEST_EVENT = {
  Created: "Created",
  Updated: "Updated",
  StageChanged: "StageChanged",
  StatusChanged: "StatusChanged",
  Assigned: "Assigned",
  Unassigned: "Unassigned",
} as const;

@Injectable()
export class RequestsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private writeHistory(
    request: RequestEntity,
    actorId: string,
    eventType: string,
    opts: {
      fromValue?: string | null;
      toValue?: string | null;
      note?: string | null;
    } = {},
  ): void {
    this.em.create(RequestHistoryEntity, {
      request,
      actor: this.em.getReference(UserEntity, actorId),
      eventType,
      module: "requests",
      fromValue: opts.fromValue ?? null,
      toValue: opts.toValue ?? null,
      note: opts.note ?? null,
    });
  }

  /** Where-clause for a single request under the caller's access scope. */
  private scopedWhere(
    id: string,
    user?: AuthenticatedUser,
  ): Record<string, unknown> {
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
    if (!request) throw new NotFoundException("Request not found");
    return request;
  }

  private async toDto(
    r: RequestEntity,
    acceptedFileCount = 0,
  ): Promise<RequestResponseDto> {
    const requestClass = r.requestType.requestClass;
    const engagementReady = wrap(r.engagement).isInitialized();
    const engagement = engagementReady ? r.engagement : null;
    const client =
      engagement && wrap(engagement.client).isInitialized() ? engagement.client : null;
    const department =
      engagement && wrap(engagement.department).isInitialized()
        ? engagement.department
        : null;
    const expected = Math.max(1, r.expectedDocumentCount ?? 1);
    const statusName = r.status ? r.status.name : null;
    const assignees = r.assignees.isInitialized()
      ? await Promise.all(
          r.assignees.getItems().map(async (a) => ({
            userId: a.user.id,
            fullName: a.user.fullName,
            avatarUrl: await presignAvatar(this.storage, a.user.avatarPath),
          })),
        )
      : [];
    return {
      id: r.id,
      engagementId: r.engagement.id,
      engagementTitle: engagement?.title ?? null,
      engagementReferenceCode: engagement?.referenceCode ?? null,
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
      departmentId: department?.id ?? null,
      departmentName: department?.name ?? null,
      requestTypeId: r.requestType.id,
      requestTypeName: r.requestType.name ?? null,
      requestClassId: requestClass.id,
      requestClassName: requestClass.name ?? null,
      stageId: r.stage ? r.stage.id : null,
      stageName: r.stage ? r.stage.name : null,
      statusId: r.status ? r.status.id : null,
      statusName,
      phase: r.phase ?? null,
      description: r.description,
      dueDate: r.dueDate ?? null,
      expectedDocumentCount: expected,
      acceptedFileCount,
      progressPercent: computeRequestProgressPercent(
        expected,
        acceptedFileCount,
        statusName,
      ),
      isOverdue: isRequestOverdue(r.dueDate, statusName),
      brief: r.briefStorageKey
        ? {
            fileName: r.briefFileName ?? "brief",
            contentType: r.briefContentType ?? null,
            sizeBytes:
              r.briefSizeBytes != null ? Number(r.briefSizeBytes) : null,
            uploadedAt: r.briefUploadedAt ?? null,
          }
        : null,
      createdAt: r.createdAt,
      assignees,
    };
  }

  private async toDetailDto(
    r: RequestEntity,
    acceptedFileCount = 0,
  ): Promise<RequestDetailResponseDto> {
    return this.toDto(r, acceptedFileCount);
  }

  private batchAcceptedFileCounts(requestIds: string[]) {
    return batchAcceptedFileCounts(this.em, requestIds);
  }

  /** Lowest-sortOrder active stage/status — the default a new request opens in. */
  private async firstStage(): Promise<RequestStageEntity | null> {
    const [row] = await this.em.find(
      RequestStageEntity,
      { isActive: true },
      { orderBy: { sortOrder: "asc", id: "asc" }, limit: 1 },
    );
    return row ?? null;
  }

  private async firstStatus(): Promise<RequestStatusEntity | null> {
    const [row] = await this.em.find(
      RequestStatusEntity,
      { isActive: true },
      { orderBy: { sortOrder: "asc", id: "asc" }, limit: 1 },
    );
    return row ?? null;
  }

  async create(
    dto: CreateRequestDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const userId = user.userId;
    const engagement = await this.em.findOne(EngagementEntity, {
      id: dto.engagementId,
    });
    if (!engagement) throw new NotFoundException("Engagement not found");

    // Staff may only raise requests on engagements they're attached to.
    const scope = resolveScope(user);
    if (scope.kind === "staff") {
      const member = await this.em.findOne(EngagementTeamMemberEntity, {
        engagement: dto.engagementId,
        user: scope.userId,
      });
      if (!member)
        throw new ForbiddenException("You are not attached to this engagement");
    }

    const requestType = await this.em.findOne(
      RequestTypeEntity,
      { id: dto.requestTypeId },
      { populate: ["requestClass"] },
    );
    if (!requestType) throw new NotFoundException("Request type not found");

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
    const stage =
      (await this.em.findOne(RequestStageEntity, {
        name: REQUEST_STAGE.NotStarted,
        isActive: true,
      })) ?? (await this.firstStage());
    if (!stage)
      throw new BadRequestException(
        "No request stage available — configure stages first",
      );
    const status = dto.statusId
      ? await this.em.findOne(RequestStatusEntity, { id: dto.statusId })
      : await this.firstStatus();
    if (!status)
      throw new BadRequestException(
        "No request status available — configure statuses first",
      );

    const expectedDocumentCount = Math.min(
      500,
      Math.max(
        1,
        dto.expectedDocumentCount ?? requestType.expectedDocuments ?? 1,
      ),
    );

    const request = this.em.create(RequestEntity, {
      engagement,
      requestType,
      stage,
      status,
      phase: dto.phase ?? phaseForStage(engagement.stage),
      description: dto.description ?? "",
      dueDate: dto.dueDate ?? null,
      expectedDocumentCount,
      briefPreviewStatus: FilePreviewStatus.None,
      createdBy: this.em.getReference(UserEntity, userId),
    });

    const clientContacts = await engagementClientContactRecipients(
      this.em,
      dto.engagementId,
    );

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const unique = [...new Set(dto.assigneeIds)];
      const found = await this.em.find(UserEntity, { id: { $in: unique } });
      if (found.length !== unique.length)
        throw new NotFoundException("One or more assignees not found");
      for (const assignee of found) {
        this.em.create(RequestAssigneeEntity, {
          request,
          user: assignee,
          assignedBy: this.em.getReference(UserEntity, userId),
        });
      }
      await this.notifications.emit({
        recipients: found.map((u) => ({
          userId: u.id,
          email: u.email ?? null,
        })),
        type: "request.assigned",
        title: "You were assigned to a request",
        body: (dto.description ?? requestType.name)?.slice(0, 140),
        entityType: "request",
        entityId: request.id,
        link: `/requests/${request.id}`,
        excludeUserId: userId,
      });
      // Clients still learn about the new request (in-app / email per flags).
      if (clientContacts.length) {
        await this.notifications.emit({
          recipients: clientContacts,
          type: "request.created",
          title: "New request on engagement",
          body: (dto.description ?? requestType.name)?.slice(0, 140),
          entityType: "request",
          entityId: request.id,
          link: `/requests/${request.id}`,
          excludeUserId: userId,
        });
      }
    } else {
      const team = await engagementTeamRecipients(this.em, dto.engagementId);
      await this.notifications.emit({
        recipients: mergeRecipients(team, clientContacts),
        type: "request.created",
        title: "New request on engagement",
        body: (dto.description ?? requestType.name)?.slice(0, 140),
        entityType: "request",
        entityId: request.id,
        link: `/requests/${request.id}`,
        excludeUserId: userId,
      });
    }

    this.writeHistory(request, userId, REQUEST_EVENT.Created, {
      note: "Request created",
    });
    await this.em.persistAndFlush(request);
    return this.getOne(request.id);
  }

  async list(
    query: RequestListQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<RequestResponseDto>> {
    const csv = (value?: string) =>
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    const csvInts = (value?: string) =>
      csv(value)
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));

    const where: Record<string, unknown> = {};

    const classIds = [
      ...csvInts(query.requestClassIds),
      ...(query.requestClassId != null ? [query.requestClassId] : []),
    ];
    if (classIds.length === 1) where.requestType = { requestClass: classIds[0] };
    else if (classIds.length > 1)
      where.requestType = { requestClass: { $in: classIds } };

    const stageIds = [
      ...csvInts(query.stageIds),
      ...(query.stageId != null ? [query.stageId] : []),
    ];
    if (stageIds.length === 1) where.stage = stageIds[0];
    else if (stageIds.length > 1) where.stage = { $in: stageIds };

    const statusIds = [
      ...csvInts(query.statusIds),
      ...(query.statusId != null ? [query.statusId] : []),
    ];
    if (statusIds.length === 1) where.status = statusIds[0];
    else if (statusIds.length > 1) where.status = { $in: statusIds };

    const phases = [
      ...csv(query.phases),
      ...(query.phase ? [query.phase] : []),
    ];
    if (phases.length === 1) where.phase = phases[0];
    else if (phases.length > 1) where.phase = { $in: phases };

    const assigneeIds = [
      ...csv(query.assigneeIds),
      ...(query.assigneeId ? [query.assigneeId] : []),
    ];
    if (assigneeIds.length === 1) where.assignees = { user: assigneeIds[0] };
    else if (assigneeIds.length > 1)
      where.assignees = { user: { $in: assigneeIds } };

    if (query.due) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      if (query.due === "overdue") {
        where.dueDate = { $lt: startOfToday };
        // Seeded done statuses; aliases (Complete/Done) are rare and filtered in app code if needed.
        where.status = { name: { $nin: ["Accepted", "Closed"] } };
      }
      if (query.due === "today") {
        where.dueDate = { $gte: startOfToday, $lt: startOfTomorrow };
      }
      if (query.due === "next7Days") {
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 8);
        where.dueDate = { $gte: startOfToday, $lt: end };
      }
      if (query.due === "noDue") where.dueDate = null;
    } else if (query.dueDate) {
      const dayStart = new Date(query.dueDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.dueDate = { $gte: dayStart, $lt: dayEnd };
    }

    const q = query.q?.trim();
    if (q) {
      const term = `%${q}%`;
      where.$or = [
        { description: { $ilike: term } },
        { requestType: { name: { $ilike: term } } },
        { requestType: { requestClass: { name: { $ilike: term } } } },
        { engagement: { title: { $ilike: term } } },
        { engagement: { referenceCode: { $ilike: term } } },
        { engagement: { client: { name: { $ilike: term } } } },
        { assignees: { user: { fullName: { $ilike: term } } } },
        { stage: { name: { $ilike: term } } },
        { status: { name: { $ilike: term } } },
      ];
    }

    // Row-level scope (Client → assigned engagements; Staff → team membership)
    // merged with optional engagement / client filters under `engagement`.
    const scope = resolveScope(user);
    const engWhere: Record<string, unknown> = {
      ...engagementScopeWhere(scope),
    };
    const engagementIds = [
      ...csv(query.engagementIds),
      ...(query.engagementId ? [query.engagementId] : []),
    ];
    if (engagementIds.length === 1) engWhere.id = engagementIds[0];
    else if (engagementIds.length > 1) engWhere.id = { $in: engagementIds };

    const clientIds = csv(query.clientIds);
    if (clientIds.length > 0) {
      if (scope.kind === "client") {
        // Client membership scope already applied; reject filters outside their org.
        if (!clientIds.includes(scope.clientId)) {
          engWhere.id = "__no_match__";
        }
      } else {
        engWhere.client = { id: { $in: clientIds } };
      }
    }
    if (Object.keys(engWhere).length) where.engagement = engWhere;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      RequestEntity,
      where as FilterQuery<RequestEntity>,
      {
        populate: [
          "requestType.requestClass",
          "stage",
          "status",
          "assignees.user",
          "engagement.client",
          "engagement.department",
        ],
        orderBy: { createdAt: "desc", id: "asc" },
        limit,
        offset,
      },
    );
    const acceptedCounts = await this.batchAcceptedFileCounts(
      rows.map((r) => r.id),
    );
    return paginated(
      await Promise.all(
        rows.map((r) => this.toDto(r, acceptedCounts.get(r.id) ?? 0)),
      ),
      total,
      page,
      pageSize,
    );
  }

  async getOne(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    await syncInferredRequestStage(this.em, id, {
      actorId: user?.userId ?? null,
    });
    await this.em.flush();

    const request = await this.findScoped(id, user, [
      "requestType.requestClass",
      "stage",
      "status",
      "assignees.user",
      "engagement.client",
      "engagement.department",
    ]);
    const acceptedCounts = await this.batchAcceptedFileCounts([id]);
    return this.toDetailDto(request, acceptedCounts.get(id) ?? 0);
  }

  async getHistory(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<RequestHistoryItemDto[]> {
    await this.findScoped(id, user);
    const rows = await this.em.find(
      RequestHistoryEntity,
      { request: id } as FilterQuery<RequestHistoryEntity>,
      { populate: ["actor"], orderBy: { createdAt: "desc" } },
    );
    return Promise.all(
      rows.map(async (h) => ({
        id: h.id,
        eventType: h.eventType,
        module: h.module,
        fromValue: h.fromValue ?? null,
        toValue: h.toValue ?? null,
        note: h.note ?? null,
        actorId: h.actor ? h.actor.id : null,
        actorName: h.actor ? h.actor.fullName : null,
        actorAvatarUrl: await presignAvatar(this.storage, h.actor?.avatarPath),
        createdAt: h.createdAt,
      })),
    );
  }

  async update(
    id: string,
    dto: UpdateRequestDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user, [
      "requestType.requestClass",
    ]);
    if (dto.description != null) request.description = dto.description;
    if (dto.dueDate !== undefined) request.dueDate = dto.dueDate ?? null;
    if (dto.expectedDocumentCount != null) {
      request.expectedDocumentCount = Math.min(
        500,
        Math.max(1, dto.expectedDocumentCount),
      );
    }
    this.writeHistory(request, user.userId, REQUEST_EVENT.Updated);
    const recipients = await assigneesOrTeamRecipients(this.em, {
      requestId: id,
      engagementId: request.engagement.id,
    });
    await this.notifications.emit({
      recipients,
      type: "request.updated",
      title: "Request updated",
      body: request.description?.slice(0, 140),
      entityType: "request",
      entityId: id,
      link: `/requests/${id}`,
      excludeUserId: user.userId,
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<{ ok: true }> {
    const request = await this.findScoped(id, user);
    const [submissionCount, documentCount] = await Promise.all([
      this.em.count(ClientSubmissionEntity, { request: id }),
      this.em.count(DocumentEntity, { request: id }),
    ]);
    if (submissionCount > 0 || documentCount > 0) {
      throw new ConflictException(
        "This request cannot be deleted because it has submissions or linked documents",
      );
    }
    await this.em.removeAndFlush(request);
    return { ok: true };
  }

  async bulkUpdate(
    dto: BulkUpdateRequestsDto,
    user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    const ids = [...new Set(dto.ids)];
    if (ids.length === 0)
      throw new BadRequestException("Select at least one request");
    if (
      dto.stageId == null &&
      dto.statusId == null &&
      dto.assigneeUserId == null
    ) {
      throw new BadRequestException("Provide at least one field to update");
    }
    if (dto.stageId != null && dto.statusId == null && dto.assigneeUserId == null) {
      throw new BadRequestException(
        "Request stage is inferred from activity and cannot be set manually",
      );
    }

    // Status / assignees bulk changes require catalogue:view (Super Admin).
    if (
      (dto.statusId != null || dto.assigneeUserId != null) &&
      !hasPermission(user.role, "catalogue:view", user.partnerDesignation)
    ) {
      throw new ForbiddenException(
        "Only Super Admin can bulk-update status or assignees",
      );
    }

    const scope = engagementScopeWhere(resolveScope(user));
    const where: Record<string, unknown> = { id: { $in: ids } };
    if (Object.keys(scope).length) where.engagement = scope;
    const requests = await this.em.find(
      RequestEntity,
      where as FilterQuery<RequestEntity>,
      {
        populate: [
          "stage",
          "status",
          "engagement.client",
          "engagement.department",
          "requestType.requestClass",
        ],
      },
    );
    if (requests.length !== ids.length) {
      throw new NotFoundException(
        "One or more requests were not found or are not accessible",
      );
    }
    const [status, assignee] = await Promise.all([
      dto.statusId != null
        ? this.em.findOne(RequestStatusEntity, { id: dto.statusId })
        : Promise.resolve(null),
      dto.assigneeUserId
        ? this.em.findOne(UserEntity, { id: dto.assigneeUserId })
        : Promise.resolve(null),
    ]);
    if (dto.statusId != null && !status)
      throw new NotFoundException("Request status not found");
    if (dto.assigneeUserId && !assignee)
      throw new NotFoundException("Assignee not found");

    for (const request of requests) {
      if (status) {
        this.writeHistory(request, user.userId, REQUEST_EVENT.StatusChanged, {
          fromValue: request.status?.name ?? null,
          toValue: status.name,
          note: "Bulk update",
        });
        request.status = status;
      }
      if (assignee) {
        await this.em.nativeDelete(RequestAssigneeEntity, {
          request: request.id,
        });
        this.em.create(RequestAssigneeEntity, {
          request,
          user: assignee,
          assignedBy: this.em.getReference(UserEntity, user.userId),
        });
        this.writeHistory(request, user.userId, REQUEST_EVENT.Assigned, {
          toValue: assignee.fullName,
          note: "Bulk assignment",
        });
      }
    }
    await this.em.flush();
    for (const request of requests) {
      await syncInferredRequestStage(this.em, request.id, {
        actorId: user.userId,
      });
    }
    await this.em.flush();
    return { updated: requests.length };
  }

  async setStage(
    _id: string,
    _dto: SetStageDto,
    _user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    throw new BadRequestException(
      "Request stage is inferred from activity and cannot be set manually",
    );
  }

  async setStatus(
    id: string,
    dto: SetStatusDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user, ["status"]);
    const status = await this.em.findOne(RequestStatusEntity, {
      id: dto.statusId,
    });
    if (!status) throw new NotFoundException("Request status not found");
    const fromValue = request.status ? request.status.name : null;
    request.status = status;
    this.writeHistory(request, user.userId, REQUEST_EVENT.StatusChanged, {
      fromValue,
      toValue: status.name,
      note: dto.note ?? null,
    });
    const recipients = await assigneesOrTeamRecipients(this.em, {
      requestId: id,
      engagementId: request.engagement.id,
    });
    await this.notifications.emit({
      recipients,
      type: "request.status_changed",
      title: `Request status: ${status.name}`,
      body: fromValue ? `${fromValue} → ${status.name}` : status.name,
      entityType: "request",
      entityId: id,
      link: `/requests/${id}`,
      excludeUserId: user.userId,
    });
    await syncInferredRequestStage(this.em, id, { actorId: user.userId });
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
    if (!assignee) throw new NotFoundException("User not found");
    const existing = await this.em.findOne(RequestAssigneeEntity, {
      request: id,
      user: dto.userId,
    });
    if (existing)
      throw new ConflictException("User is already assigned to this request");
    this.em.create(RequestAssigneeEntity, {
      request,
      user: assignee,
      assignedBy: this.em.getReference(UserEntity, user.userId),
    });
    this.writeHistory(request, user.userId, REQUEST_EVENT.Assigned, {
      toValue: assignee.fullName,
    });
    await this.notifications.emit({
      recipients: [{ userId: assignee.id, email: assignee.email ?? null }],
      type: "request.assigned",
      title: "You were assigned to a request",
      body: request.description?.slice(0, 140),
      entityType: "request",
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
      { populate: ["user"] },
    );
    if (!existing)
      throw new NotFoundException("User is not assigned to this request");
    this.writeHistory(request, user.userId, REQUEST_EVENT.Unassigned, {
      fromValue: existing.user.fullName,
    });
    await this.notifications.emit({
      recipients: [
        { userId: existing.user.id, email: existing.user.email ?? null },
      ],
      type: "request.unassigned",
      title: "You were unassigned from a request",
      body: request.description?.slice(0, 140),
      entityType: "request",
      entityId: id,
      link: `/requests/${id}`,
      excludeUserId: user.userId,
    });
    await this.em.remove(existing).flush();
    return this.getOne(id, user);
  }

  private briefKeyPrefix(request: RequestEntity): string {
    return `requests/${request.engagement.id}/${request.id}/brief`;
  }

  async presignBrief(
    id: string,
    dto: PresignRequestBriefDto,
    user: AuthenticatedUser,
  ) {
    const request = await this.findScoped(id, user);
    if (dto.sizeBytes != null && dto.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    return this.storage.presignUpload({
      keyPrefix: this.briefKeyPrefix(request),
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async confirmBrief(
    id: string,
    dto: ConfirmRequestBriefDto,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user);
    const prefix = this.briefKeyPrefix(request);
    if (!dto.storageKey.includes(prefix)) {
      throw new BadRequestException("Invalid storage key for this request brief");
    }
    if (dto.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException("Uploaded object not found");
    if (dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    request.briefStorageKey = dto.storageKey;
    request.briefFileName = dto.fileName;
    request.briefContentType = dto.contentType;
    request.briefSizeBytes = head.sizeBytes;
    request.briefUploadedAt = new Date();
    request.briefPreviewStorageKey = null;
    request.briefPreviewError = null;
    const previewStatus = initialPreviewStatus(dto.contentType, dto.fileName);
    request.briefPreviewStatus = previewStatus;
    if (previewStatus === FilePreviewStatus.Pending) {
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "request_brief",
        fileId: request.id,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.contentType ?? null,
      });
    }
    this.writeHistory(request, user.userId, REQUEST_EVENT.Updated, {
      note: "Expectation brief uploaded",
    });
    await this.em.flush();
    return this.getOne(id, user);
  }

  async downloadBrief(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; fileName: string }> {
    const request = await this.findScoped(id, user);
    if (!request.briefStorageKey || !request.briefFileName) {
      throw new NotFoundException("No expectation brief on this request");
    }
    const downloadUrl = await this.storage.presignDownload(
      request.briefStorageKey,
      request.briefFileName,
    );
    return { downloadUrl, fileName: request.briefFileName };
  }

  /**
   * In-app preview for the expectation brief — same pipeline as submission files
   * (native inline types, or LibreOffice→PDF for Office).
   */
  async previewBrief(
    id: string,
    user: AuthenticatedUser,
    opts?: { retryFailed?: boolean },
  ): Promise<{
    url: string | null;
    mode: "native" | "converted" | "unavailable";
    previewStatus: FilePreviewStatus;
    reason?: "pending" | "failed" | "unsupported";
  }> {
    const request = await this.findScoped(id, user);
    if (!request.briefStorageKey || !request.briefFileName) {
      throw new NotFoundException("No expectation brief on this request");
    }
    const mime = request.briefContentType ?? null;
    const name = request.briefFileName;

    if (isBlockedPreviewType(mime, name)) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.None,
        reason: "unsupported",
      };
    }

    if (
      request.briefPreviewStatus === FilePreviewStatus.Ready &&
      request.briefPreviewStorageKey
    ) {
      const url = await this.storage.presignDownload(
        request.briefPreviewStorageKey,
        `${name}.pdf`,
        { disposition: "inline" },
      );
      return {
        url,
        mode: "converted",
        previewStatus: request.briefPreviewStatus,
      };
    }

    if (isNativePreviewable(mime, name)) {
      const url = await this.storage.presignDownload(
        request.briefStorageKey,
        name,
        { disposition: "inline" },
      );
      return {
        url,
        mode: "native",
        previewStatus: FilePreviewStatus.Ready,
      };
    }

    if (
      opts?.retryFailed &&
      request.briefPreviewStatus === FilePreviewStatus.Failed &&
      isOfficeMime(mime, name)
    ) {
      request.briefPreviewStatus = FilePreviewStatus.Pending;
      request.briefPreviewError = null;
      this.outbox.enqueue(EVENT.FilePreviewRequested, {
        entityType: "request_brief",
        fileId: request.id,
        storageKey: request.briefStorageKey,
        fileName: name,
        mimeType: mime,
      });
      await this.em.flush();
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Pending,
        reason: "pending",
      };
    }

    // Lazy-enqueue for existing Office briefs uploaded before this pipeline.
    if (
      isOfficeMime(mime, name) &&
      (request.briefPreviewStatus === FilePreviewStatus.None ||
        request.briefPreviewStatus === FilePreviewStatus.Pending)
    ) {
      if (request.briefPreviewStatus === FilePreviewStatus.None) {
        request.briefPreviewStatus = FilePreviewStatus.Pending;
        request.briefPreviewError = null;
        this.outbox.enqueue(EVENT.FilePreviewRequested, {
          entityType: "request_brief",
          fileId: request.id,
          storageKey: request.briefStorageKey,
          fileName: name,
          mimeType: mime,
        });
        await this.em.flush();
      }
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Pending,
        reason: "pending",
      };
    }

    if (request.briefPreviewStatus === FilePreviewStatus.Failed) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: FilePreviewStatus.Failed,
        reason: "failed",
      };
    }

    if (!isPreviewAllowlisted(mime, name)) {
      return {
        url: null,
        mode: "unavailable",
        previewStatus: request.briefPreviewStatus,
        reason: "unsupported",
      };
    }

    return {
      url: null,
      mode: "unavailable",
      previewStatus: request.briefPreviewStatus,
      reason: "unsupported",
    };
  }

  async removeBrief(
    id: string,
    user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    const request = await this.findScoped(id, user);
    if (!request.briefStorageKey) {
      throw new NotFoundException("No expectation brief on this request");
    }
    request.briefStorageKey = null;
    request.briefFileName = null;
    request.briefContentType = null;
    request.briefSizeBytes = null;
    request.briefUploadedAt = null;
    request.briefPreviewStorageKey = null;
    request.briefPreviewStatus = FilePreviewStatus.None;
    request.briefPreviewError = null;
    this.writeHistory(request, user.userId, REQUEST_EVENT.Updated, {
      note: "Expectation brief removed",
    });
    await this.em.flush();
    return this.getOne(id, user);
  }
}
