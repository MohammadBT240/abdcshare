import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { LibraryEventAction } from '@abdcshare/shared';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { LibraryEventEntity } from './infrastructure/persistence/library-event.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import type { LibraryViewer } from './library-access';
import type { LibraryEventDto, LibraryEventListDto } from './presentation/dto/library-event.dto';

export interface LibraryEventInput {
  action: LibraryEventAction;
  viewer: Pick<LibraryViewer, 'userId' | 'ip' | 'userAgent'> | null;
  itemId?: string | null;
  collectionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const LIBRARY_EVENTS_PAGE_MAX = 100;

/** Keyset cursor over (created_at, id), opaque to clients. */
export function encodeCursor(at: string, id: string): string {
  // `at` is Postgres' own text form of the timestamptz, so microseconds survive the round trip.
  return Buffer.from(`${at}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { at: string; id: string } {
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!at || !id || !/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)?$/.test(at)) {
    throw new BadRequestException('Invalid cursor');
  }
  return { at, id };
}

/**
 * The library activity log (S2, D15). Two ways in:
 *  - {@link stage}: persisted with the caller's next flush, so the event commits (or rolls
 *    back) with the change it describes;
 *  - {@link insertNow}: written immediately — for reads (views/downloads), after the URL
 *    has been presigned.
 */
@Injectable()
export class LibraryEventsService {
  constructor(private readonly em: EntityManager) {}

  private build(input: LibraryEventInput): LibraryEventEntity {
    return this.em.create(LibraryEventEntity, {
      action: input.action,
      item: input.itemId ? this.em.getReference(LibraryItemEntity, input.itemId) : null,
      collection: input.collectionId ? this.em.getReference(LibraryCollectionEntity, input.collectionId) : null,
      actor: input.viewer ? this.em.getReference(UserEntity, input.viewer.userId) : null,
      ip: input.viewer?.ip ?? null,
      userAgent: input.viewer?.userAgent?.slice(0, 300) ?? null,
      metadata: input.metadata ?? null,
    });
  }

  /** `em`: pass the transaction's EntityManager when staging inside `em.transactional`. */
  stage(input: LibraryEventInput, em: EntityManager = this.em): void {
    em.persist(this.build(input));
  }

  async insertNow(input: LibraryEventInput): Promise<void> {
    await this.em.execute(
      `insert into library_events (item_id, collection_id, actor_id, action, ip, user_agent, metadata, created_at)
       values (?, ?, ?, ?, ?, ?, ?, now())`,
      [
        input.itemId ?? null,
        input.collectionId ?? null,
        input.viewer?.userId ?? null,
        input.action,
        input.viewer?.ip ?? null,
        input.viewer?.userAgent?.slice(0, 300) ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  }

  /** Before an item row is deleted: keep its title on every event (item_id is then set null by the FK). */
  async snapshotTitle(itemId: string, title: string): Promise<void> {
    await this.em.execute(
        `update library_events set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('itemTitle', ?::text) where item_id = ?`,
        [title, itemId],
      );
  }

  /** Item timeline, newest first, cursor = last seen event id. Callers check rights first. */
  async forItem(itemId: string, opts: { cursor?: string; limit?: number }): Promise<LibraryEventListDto> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), LIBRARY_EVENTS_PAGE_MAX);
    const after = opts.cursor ? decodeCursor(opts.cursor) : null;
    const rows = await this.em.execute<
      {
        id: string;
        action: LibraryEventAction;
        actor_id: string | null;
        actor_name: string | null;
        collection_id: string | null;
        collection_title: string | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        at: string;
      }[]
    >(
      `select e.id::text as id, e.action, e.actor_id, u.full_name as actor_name, e.collection_id,
              c.title as collection_title, e.metadata, e.created_at, e.created_at::text as at
         from library_events e
         left join users u on u.id = e.actor_id
         left join library_collections c on c.id = e.collection_id
        where e.item_id = ? ${after ? 'and (e.created_at, e.id) < (?::timestamptz, ?::bigint)' : ''}
        order by e.created_at desc, e.id desc
        limit ?`,
      after ? [itemId, after.at, after.id, limit + 1] : [itemId, limit + 1],
    );
    const page = rows.slice(0, limit);
    const data: LibraryEventDto[] = page.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor_id ? { id: r.actor_id, name: r.actor_name ?? 'Unknown user' } : null,
      collection: r.collection_id ? { id: r.collection_id, title: r.collection_title ?? '' } : null,
      metadata: r.metadata ?? {},
      createdAt: new Date(r.created_at),
    }));
    const last = page[page.length - 1];
    return { data, nextCursor: rows.length > limit && last ? encodeCursor(last.at, last.id) : null };
  }

  /** Per-action totals for an item's summary strip. */
  async summary(itemId: string): Promise<Record<string, number>> {
    const rows = await this.em.execute<{ action: string; n: number }[]>(
        `select action, count(*)::int as n from library_events where item_id = ? group by action`,
        [itemId],
      );
    return Object.fromEntries(rows.map((r) => [r.action, Number(r.n)]));
  }
}
