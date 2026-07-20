import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { FsLineEntity } from '../../../fs-lines/infrastructure/persistence/fs-line.entity';

@Entity({ tableName: 'request_types' })
@Unique({ properties: ['fsLine', 'name'] })
export class RequestTypeEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => FsLineEntity)
  fsLine!: FsLineEntity;

  @Property()
  name!: string;

  @Property({ default: 1 })
  expectedDocuments: number = 1;

  @Property({ default: true })
  isActive: boolean = true;
}
