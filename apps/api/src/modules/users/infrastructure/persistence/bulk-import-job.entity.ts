import { Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { UserEntity } from './user.entity';

export enum BulkImportKind { Users = 'Users' }
export enum BulkImportStatus { Pending = 'Pending', Validated = 'Validated', Imported = 'Imported', Failed = 'Failed' }

@Entity({ tableName: 'bulk_import_jobs' })
export class BulkImportJobEntity extends BaseEntity {
  @Enum(() => BulkImportKind)
  kind: BulkImportKind = BulkImportKind.Users;

  @Enum(() => BulkImportStatus)
  status: BulkImportStatus = BulkImportStatus.Pending;

  @Property({ default: 0 })
  totalRows: number = 0;

  @Property({ default: 0 })
  validRows: number = 0;

  @Property({ default: 0 })
  errorRows: number = 0;

  @Property({ type: 'json', nullable: true })
  result?: unknown;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
