import { Entity, Enum, Index, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { LibraryReportOutcome, LibraryReportReason, LibraryReportStatus } from '@abdcshare/shared';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { LibraryItemEntity } from './library-item.entity';

/**
 * "Report this item" (S2, D19/D20). The item stays visible until a curator acts.
 * `item` becomes null if the item is deleted; `itemTitle` keeps what was reported.
 */
@Entity({ tableName: 'library_reports' })
@Index({ name: 'library_reports_status_created_idx', properties: ['status', 'createdAt'] })
@Index({ name: 'library_reports_item_idx', properties: ['item'] })
export class LibraryReportEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'status' | 'note' | 'outcome' | 'resolution' | 'resolvedBy' | 'resolvedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => LibraryItemEntity, { nullable: true, deleteRule: 'set null', index: false })
  item?: LibraryItemEntity | null;

  @Property({ length: 300 })
  itemTitle!: string;

  @ManyToOne(() => UserEntity)
  reporter!: UserEntity;

  @Enum({ items: () => LibraryReportReason })
  reason!: LibraryReportReason;

  @Property({ type: 'text', nullable: true })
  note?: string | null;

  @Enum({ items: () => LibraryReportStatus, default: LibraryReportStatus.Open })
  status: LibraryReportStatus = LibraryReportStatus.Open;

  @Enum({ items: () => LibraryReportOutcome, nullable: true })
  outcome?: LibraryReportOutcome | null;

  /** Curator's note to the reporter. */
  @Property({ type: 'text', nullable: true })
  resolution?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  resolvedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();
}
