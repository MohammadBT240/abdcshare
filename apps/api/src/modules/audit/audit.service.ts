import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
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
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId ?? null,
      ipAddress: a.ipAddress ?? null,
      metadata: a.metadata ?? null,
      createdAt: a.createdAt,
    };
  }

  async list(query: AuditListQueryDto): Promise<Paginated<AuditResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actor = query.actorId;

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      ActivityLogEntity,
      where as FilterQuery<ActivityLogEntity>,
      { populate: ['actor'], orderBy: { createdAt: 'desc', id: 'asc' }, limit, offset },
    );
    return paginated(rows.map((a) => this.toDto(a)), total, page, pageSize);
  }
}
