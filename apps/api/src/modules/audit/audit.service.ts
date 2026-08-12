import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { toCsv } from '../../common/utils/csv';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { ActivityLogEntity } from './infrastructure/persistence/activity-log.entity';
import type { AuditListQueryDto } from './presentation/dto/audit.dto';
import { AuditResponseDto } from './presentation/dto/audit.dto';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

const EXPORT_CAP = 10_000;
const EXPORT_HEADERS = [
  'createdAt',
  'actorName',
  'actorEmail',
  'action',
  'entityType',
  'entityId',
  'ipAddress',
  'metadata',
] as const;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly em: EntityManager) {}

  /** Write one immutable activity-log row (best-effort — never breaks the request). */
  async record(input: AuditInput): Promise<void> {
    try {
      const em = this.em.fork();
      em.create(ActivityLogEntity, {
        actor: input.actorId ? em.getReference(UserEntity, input.actorId) : null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        metadata: input.metadata ?? null,
      });
      await em.flush();
    } catch (err) {
      this.logger.warn(`audit write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private toDto(a: ActivityLogEntity): AuditResponseDto {
    return {
      id: a.id,
      actorId: a.actor ? a.actor.id : null,
      actorName: a.actor?.fullName ?? null,
      actorEmail: a.actor?.email ?? null,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId ?? null,
      ipAddress: a.ipAddress ?? null,
      metadata: a.metadata ?? null,
      createdAt: a.createdAt,
    };
  }

  /** Inclusive date bounds; date-only strings cover the full UTC day. */
  private parseDateBound(value: string, endOfDay: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    }
    return new Date(value);
  }

  private buildWhere(query: AuditListQueryDto): FilterQuery<ActivityLogEntity> {
    const where: Record<string, unknown> = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actor = query.actorId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt.$gte = this.parseDateBound(query.dateFrom, false);
      if (query.dateTo) createdAt.$lte = this.parseDateBound(query.dateTo, true);
      where.createdAt = createdAt;
    }

    const q = query.q?.trim();
    if (q) {
      const term = `%${q}%`;
      const or: FilterQuery<ActivityLogEntity>[] = [
        { action: { $ilike: term } },
        { entityType: { $ilike: term } },
        { ipAddress: { $ilike: term } },
        { actor: { fullName: { $ilike: term } } },
        { actor: { email: { $ilike: term } } },
      ];
      // UUID column: exact match when the query looks like an id
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
        or.push({ entityId: q });
        or.push({ actor: q });
      }
      where.$or = or;
    }

    return where as FilterQuery<ActivityLogEntity>;
  }

  async list(query: AuditListQueryDto): Promise<Paginated<AuditResponseDto>> {
    const where = this.buildWhere(query);
    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(ActivityLogEntity, where, {
      populate: ['actor'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(
      rows.map((a) => this.toDto(a)),
      total,
      page,
      pageSize,
    );
  }

  /** CSV export with the same filters as list; hard-capped at 10_000 rows. */
  async exportCsv(query: AuditListQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const rows = await this.em.find(ActivityLogEntity, where, {
      populate: ['actor'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit: EXPORT_CAP,
    });
    const data = rows.map((a) => {
      const dto = this.toDto(a);
      return {
        createdAt: dto.createdAt instanceof Date ? dto.createdAt.toISOString() : String(dto.createdAt),
        actorName: dto.actorName ?? '',
        actorEmail: dto.actorEmail ?? '',
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId ?? '',
        ipAddress: dto.ipAddress ?? '',
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : '',
      };
    });
    return toCsv(data, [...EXPORT_HEADERS]);
  }
}
